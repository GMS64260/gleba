/**
 * Orchestration des envois : résumé quotidien + alertes temps réel.
 *
 * Chaque exécution est isolée (try/catch par utilisateur et par étape) :
 * une erreur de météo, de SMTP ou de base ne fait jamais tomber le cron.
 * L'anti-redondance (store en mémoire) est scellée par utilisateur pour
 * que chaque compte reçoive bien ses propres alertes.
 */

import { sendMail } from "@/lib/mail"
import { getSetting } from "@/lib/settings"
import { getOrCreateUnsubscribeToken, listUnsubscribeHeaders, unsubscribeUrl } from "@/lib/unsubscribe"
import {
  chargerStocksBas,
  chargerTachesDuJour,
  chargerTachesItpSemaine,
  chargerPrefsNotif,
  detecterAlertesUrgentes,
  getDestinatairesNotifications,
  getCoordsUtilisateur,
  recupererAlertesMeteoJour,
} from "./queries"
import {
  alerteDejaEnvoyee,
  marquerAlerteEnvoyee,
  nettoyerAlertesEnvoyees,
} from "./store"
import { detecterAlertesMeteo } from "./detect"
import { construireResume } from "./resume"
import { alerteMeteoEmail, alerteUrgenteEmail, resumeQuotidienEmail } from "./templates"
import type { AlerteMeteoNotification, DestinataireNotification } from "./types"
import {
  auMoinsUneAlerteUrgenteActivee,
  DEFAULT_NOTIF_PREFS,
  typeAlerteEstActivee,
  type NotifPrefs,
} from "./prefs"
import { fetchOpenMeteoForecast } from "@/lib/meteo"
import {
  construirePayloadAlerteUrgente,
  envoyerPushUtilisateur,
} from "@/lib/push"

/** Nombre maximal d'emails envoyés par utilisateur et par scan (anti-spam). */
const MAX_EMAILS_PAR_UTILISATEUR = 15

/**
 * Résout le désabonnement du destinataire : ces emails sont récurrents et non
 * transactionnels, ils doivent porter un lien 1 clic + les en-têtes
 * List-Unsubscribe (RFC 8058, exigé par Gmail/Yahoo pour les envois de masse),
 * comme les campagnes. Une erreur de résolution ne bloque pas l'envoi : on part
 * alors sans lien plutôt que de perdre l'alerte.
 */
async function avecDesabonnement(
  user: DestinataireNotification
): Promise<{ user: DestinataireNotification; headers?: Record<string, string> }> {
  try {
    const token = await getOrCreateUnsubscribeToken(user.id)
    return {
      user: { ...user, unsubscribeUrl: unsubscribeUrl(token) },
      headers: listUnsubscribeHeaders(token),
    }
  } catch (error) {
    console.warn(`[notifications] Token de désabonnement indisponible pour ${user.email}:`, error)
    return { user }
  }
}

/** Charge les préférences sans laisser une erreur de lecture bloquer l'envoi. */
async function chargerPrefsNotifAvecFallback(user: DestinataireNotification): Promise<NotifPrefs> {
  try {
    return await chargerPrefsNotif(user.id)
  } catch (error) {
    console.warn(`[notifications] Préférences indisponibles pour ${user.email}:`, error)
    return { ...DEFAULT_NOTIF_PREFS }
  }
}

/** Les notifications sont-elles activées ? (défaut : oui si SMTP configuré). */
export async function notificationsEnabled(): Promise<boolean> {
  const enabled = await getSetting("notif.enabled")
  if (!enabled) return false
  const [host, user] = await Promise.all([
    getSetting("smtp.host"),
    getSetting("smtp.user"),
  ])
  return Boolean(host && user)
}

/**
 * Scan météo temps réel : pour chaque utilisateur, détecte les conditions
 * dangereuses sur les 48 h à venir et email chaque nouvelle alerte.
 */
export async function envoyerAlertesMeteoTempsReel(): Promise<number> {
  if (!(await notificationsEnabled())) return 0
  nettoyerAlertesEnvoyees()
  const users = await getDestinatairesNotifications()
  let total = 0
  for (const user of users) {
    try {
      const prefs = await chargerPrefsNotifAvecFallback(user)
      if (!prefs.meteo) continue
      total += await traiterMeteoUtilisateur(user)
    } catch (error) {
      console.error(`[notifications] Scan météo échoué pour ${user.email}:`, error)
    }
  }
  return total
}

async function traiterMeteoUtilisateur(user: DestinataireNotification): Promise<number> {
  const coords = await getCoordsUtilisateur(user.id)
  if (coords.length === 0) return 0

  const seuils = {
    gel: await getSetting("seuil.gel"),
    canicule: await getSetting("seuil.canicule"),
    ventFort: await getSetting("seuil.ventFort"),
    pluieAbondante: await getSetting("seuil.pluieAbondante"),
  }

  const { user: destinataire, headers } = await avecDesabonnement(user)


  const alertes: AlerteMeteoNotification[] = []
  for (const { lat, lng } of coords) {
    try {
      const { current, daily } = await fetchOpenMeteoForecast(lat, lng)
      // Temps réel = conditions actuelles + 48 h (gel de la nuit, canicule du lendemain…)
      alertes.push(
        ...detecterAlertesMeteo(daily, current, {
          horizonJours: 2,
          seuils,
        })
      )
    } catch (error) {
      console.warn(`[notifications] Prévisions indisponibles (${lat},${lng}):`, error)
    }
  }

  // Déduplication au sein d'un même scan (2 parcelles proches → 1 email)
  const envoyees = new Set<string>()
  let total = 0
  for (const alerte of alertes) {
    if (total >= MAX_EMAILS_PAR_UTILISATEUR) {
      console.warn(`[notifications] Cap anti-spam atteint pour ${user.email}`)
      break
    }
    const cle = `${user.id}:${alerte.key}`
    if (envoyees.has(cle) || alerteDejaEnvoyee(cle)) continue
    try {
      const { subject, html } = alerteMeteoEmail(destinataire, alerte)
      await sendMail({ to: user.email, subject, html, headers })
      marquerAlerteEnvoyee(cle, { until: alerte.date })
      envoyees.add(cle)
      total++
    } catch (error) {
      console.error(`[notifications] Envoi alerte météo échoué pour ${user.email}:`, error)
    }
  }
  return total
}

/**
 * Scan temps réel des actions urgentes : irrigations probablement inutiles,
 * associations incompatibles, tâches en retard.
 */
export async function envoyerAlertesUrgentes(): Promise<number> {
  if (!(await notificationsEnabled())) return 0
  const users = await getDestinatairesNotifications()
  let total = 0
  for (const user of users) {
    try {
      const prefs = await chargerPrefsNotifAvecFallback(user)
      // Les alertes sont sur opt-in : sans aucun type demandé, ne pas payer la
      // détection (une dizaine de requêtes Prisma + météo par utilisateur) pour
      // en jeter le résultat juste après. Sur 112 comptes toutes les 30 min,
      // c'est la différence entre un scan inutile et un scan gratuit.
      if (!auMoinsUneAlerteUrgenteActivee(prefs)) continue

      const urgentes = (await detecterAlertesUrgentes(user.id)).filter((alerte) =>
        typeAlerteEstActivee(alerte.type, prefs)
      )
      if (urgentes.length === 0) continue

      // Résolu seulement quand il y a réellement quelque chose à envoyer :
      // getOrCreateUnsubscribeToken peut ÉCRIRE (création du token au premier
      // usage), inutile de le faire à chaque scan pour tout le monde.
      const { user: destinataire, headers } = await avecDesabonnement(user)
      let envoyees = 0
      for (const alerte of urgentes) {
        if (envoyees >= MAX_EMAILS_PAR_UTILISATEUR) {
          console.warn(`[notifications] Cap anti-spam atteint pour ${user.email}`)
          break
        }
        const cle = `${user.id}:${alerte.key}`
        if (alerteDejaEnvoyee(cle)) continue
        let emailEnvoye = false
        try {
          const { subject, html } = alerteUrgenteEmail(destinataire, alerte)
          await sendMail({ to: user.email, subject, html, headers })
          emailEnvoye = true
        } catch (error) {
          console.error(`[notifications] Envoi alerte urgente échoué pour ${user.email}:`, error)
        }

        try {
          await envoyerPushUtilisateur(user.id, construirePayloadAlerteUrgente(alerte))
        } catch (error) {
          // Une panne push ne doit jamais empêcher la livraison email ni le scan.
          console.error(`[notifications] Envoi push urgent échoué pour ${user.email}:`, error)
        }

        // L'alerte est scellée dès que l'email a été livré ; une subscription
        // push morte ou indisponible ne doit pas provoquer un doublon email.
        if (emailEnvoye) {
          marquerAlerteEnvoyee(cle)
          envoyees++
        }
      }
      total += envoyees
    } catch (error) {
      console.error(`[notifications] Scan urgent échoué pour ${user.email}:`, error)
    }
  }
  return total
}

/** Résumé quotidien « Quoi faire ce matin ? » pour chaque utilisateur. */
export async function envoyerResumeQuotidien(): Promise<number> {
  if (!(await notificationsEnabled())) return 0
  const users = await getDestinatairesNotifications()
  let total = 0
  for (const user of users) {
    try {
      const prefs = await chargerPrefsNotifAvecFallback(user)
      if (!prefs.resume) continue
      // Le résumé embarquait les blocs « Cette semaine » (tâches ITP) et
      // « Stocks bas » quel que soit l'état de leurs cases dans /parametres :
      // décocher « Tâches ITP de la semaine » n'avait aucun effet ici, seulement
      // sur l'alerte dédiée. On respecte la préférence des deux côtés.
      const [taches, alertesMeteo, tachesItpSemaine, stocksBas] = await Promise.all([
        chargerTachesDuJour(user.id),
        recupererAlertesMeteoJour(user.id),
        prefs.itpSemaine ? chargerTachesItpSemaine(user.id) : Promise.resolve([]),
        prefs.stocks ? chargerStocksBas(user.id) : Promise.resolve([]),
      ])
      const resume = construireResume(taches, alertesMeteo, { tachesItpSemaine, stocksBas })
      const { user: destinataire, headers } = await avecDesabonnement(user)
      const { subject, html } = resumeQuotidienEmail(destinataire, resume)
      await sendMail({ to: user.email, subject, html, headers })
      total++
    } catch (error) {
      console.error(`[notifications] Résumé quotidien échoué pour ${user.email}:`, error)
    }
  }
  return total
}
