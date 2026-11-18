/**
 * Orchestration des envois : résumé quotidien + alertes temps réel.
 *
 * Chaque exécution est isolée (try/catch par utilisateur et par étape) :
 * une erreur de météo, de SMTP ou de base ne fait jamais tomber le cron.
 * L'anti-redondance est scellée par utilisateur pour que chaque compte reçoive
 * bien ses propres alertes, et elle est PERSISTÉE depuis le 2026-08-20 : un
 * redémarrage du conteneur rejouait sinon les alertes du jour (mesuré deux fois
 * dans la même journée, cf. `store.ts`). Chaque scan commence donc par purger
 * puis précharger le store.
 */

import { sendMail, smtpConfigure } from "@/lib/mail"
import { serviceAutorise } from "@/lib/abonnement/serveur"
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
  prechargerAlertesEnvoyees,
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
import { jourLocalISO } from "@/lib/jour-civil"
import {
  construirePayloadAlerteUrgente,
  envoyerPushUtilisateur,
  pushConfigure,
} from "@/lib/push"

/** Nombre maximal d'emails envoyés par utilisateur et par scan (anti-spam). */
const MAX_EMAILS_PAR_UTILISATEUR = 15
/** Même plafond pour les alertes urgentes, quel que soit le canal accepté. */
const MAX_ALERTES_URGENTES_PAR_UTILISATEUR = 15

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

/** Activation globale ; chaque envoi vérifie ensuite ses propres transports. */
export async function notificationsEnabled(): Promise<boolean> {
  return Boolean(await getSetting("notif.enabled"))
}

/**
 * Scan météo temps réel : pour chaque utilisateur, détecte les conditions
 * dangereuses sur les 48 h à venir et email chaque nouvelle alerte.
 */
export async function envoyerAlertesMeteoTempsReel(): Promise<number> {
  if (!(await notificationsEnabled()) || !(await smtpConfigure())) return 0
  await nettoyerAlertesEnvoyees()
  await prechargerAlertesEnvoyees()
  const users = await getDestinatairesNotifications()
  let total = 0
  for (const user of users) {
    try {
      const prefs = await chargerPrefsNotifAvecFallback(user)
      if (!prefs.meteo) continue
      total += await traiterMeteoUtilisateur(user)
    } catch (error) {
      console.error(`[notifications] Scan météo échoué pour ${user.id}:`, error)
    }
  }
  return total
}

async function traiterMeteoUtilisateur(user: DestinataireNotification): Promise<number> {
  if (!await serviceAutorise(user.id, "meteo")) return 0
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
    if (envoyees.has(cle) || (await alerteDejaEnvoyee(cle))) continue
    try {
      const { subject, html } = alerteMeteoEmail(destinataire, alerte)
      await sendMail({ to: user.email, subject, html, headers })
      await marquerAlerteEnvoyee(cle, { until: alerte.date })
      envoyees.add(cle)
      total++
    } catch (error) {
      console.error(`[notifications] Envoi alerte météo échoué pour ${user.id}:`, error)
    }
  }
  return total
}

/**
 * Scan temps réel des actions urgentes : irrigations probablement inutiles,
 * associations incompatibles, tâches en retard.
 * Retourne le nombre d'alertes acceptées par au moins un canal durant ce scan.
 */
export async function envoyerAlertesUrgentes(): Promise<number> {
  if (!(await notificationsEnabled())) return 0
  const [mailPret, pushPret] = await Promise.all([smtpConfigure(), pushConfigure()])
  if (!mailPret && !pushPret) return 0
  await nettoyerAlertesEnvoyees()
  await prechargerAlertesEnvoyees()
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

      // Le push seul n'a pas besoin de créer un jeton de désabonnement mail.
      let desabonnement: Awaited<ReturnType<typeof avecDesabonnement>> | undefined
      let envoyees = 0
      for (const alerte of urgentes) {
        if (envoyees >= MAX_ALERTES_URGENTES_PAR_UTILISATEUR) {
          console.warn(`[notifications] Cap anti-spam atteint pour ${user.email}`)
          break
        }
        // La clé historique reste celle du mail. Le push a son propre
        // acquittement persistant, toujours cloisonné par utilisateur.
        const cle = `${user.id}:${alerte.key}`
        const clePush = `${user.id}:push:${alerte.key}`
        const envoyerMail = mailPret && !(await alerteDejaEnvoyee(cle))
        const envoyerPush = pushPret && !(await alerteDejaEnvoyee(clePush))
        if (!envoyerMail && !envoyerPush) continue
        let emailEnvoye = false
        if (envoyerMail) {
          try {
            desabonnement ??= await avecDesabonnement(user)
            const { user: destinataire, headers } = desabonnement
            const { subject, html } = alerteUrgenteEmail(destinataire, alerte)
            await sendMail({ to: user.email, subject, html, headers })
            emailEnvoye = true
          } catch (error) {
            console.error(`[notifications] Envoi alerte urgente échoué pour ${user.id}:`, error)
          }
        }

        // L'alerte est scellée dès que l'email a été livré, AVANT le push :
        // une subscription push lente, morte ou indisponible ne doit ni
        // retarder ce scellement ni provoquer un doublon email (revue Codex du
        // 2026-11-12, SEC-05).
        if (emailEnvoye) {
          await marquerAlerteEnvoyee(cle)
        }

        let pushAccepte = false
        if (envoyerPush) {
          try {
            // Chaque abonnement est borné par son propre délai (`push-reseau.ts`).
            pushAccepte = (await envoyerPushUtilisateur(user.id, construirePayloadAlerteUrgente(alerte))) > 0
            if (pushAccepte) await marquerAlerteEnvoyee(clePush)
          } catch (error) {
            // Une panne push ne doit jamais empêcher la livraison email ni le scan.
            console.error(`[notifications] Envoi push urgent échoué pour ${user.id}:`, error)
          }
        }
        if (emailEnvoye || pushAccepte) envoyees++
      }
      total += envoyees
    } catch (error) {
      console.error(`[notifications] Scan urgent échoué pour ${user.id}:`, error)
    }
  }
  return total
}

/**
 * Résumé quotidien « Quoi faire ce matin ? » pour chaque utilisateur.
 *
 * Un résumé PAR JOUR ET PAR COMPTE, garanti par le même store persistant que
 * les alertes. Il n'avait aucune garde : le cron est censé ne tirer qu'une fois
 * à l'heure dite, mais rien n'empêchait un second envoi si le processus était
 * relancé au passage de cette heure — et « censé » n'est pas une garantie quand
 * la conséquence est un courriel en double chez 115 comptes.
 */
export async function envoyerResumeQuotidien(): Promise<number> {
  if (!(await notificationsEnabled()) || !(await smtpConfigure())) return 0
  await nettoyerAlertesEnvoyees()
  await prechargerAlertesEnvoyees()
  const users = await getDestinatairesNotifications()
  const jour = jourLocalISO(new Date())
  let total = 0
  for (const user of users) {
    try {
      const prefs = await chargerPrefsNotifAvecFallback(user)
      if (!prefs.resume) continue
      const cleResume = `${user.id}:resume:${jour}`
      if (await alerteDejaEnvoyee(cleResume)) continue
      // Le résumé embarquait les blocs « Cette semaine » (tâches ITP) et
      // « Stocks bas » quel que soit l'état de leurs cases dans /parametres :
      // décocher « Tâches ITP de la semaine » n'avait aucun effet ici, seulement
      // sur l'alerte dédiée. On respecte la préférence des deux côtés.
      const [taches, alertesMeteo, tachesItpSemaine, stocksBas] = await Promise.all([
        chargerTachesDuJour(user.id),
        serviceAutorise(user.id, "meteo").then(autorise => autorise ? recupererAlertesMeteoJour(user.id) : []),
        prefs.itpSemaine ? chargerTachesItpSemaine(user.id) : Promise.resolve([]),
        prefs.stocks ? chargerStocksBas(user.id) : Promise.resolve([]),
      ])
      const resume = construireResume(taches, alertesMeteo, { tachesItpSemaine, stocksBas })
      const { user: destinataire, headers } = await avecDesabonnement(user)
      const { subject, html } = resumeQuotidienEmail(destinataire, resume)
      await sendMail({ to: user.email, subject, html, headers })
      // Scellé APRÈS l'envoi : un échec SMTP doit laisser le résumé rejouable.
      await marquerAlerteEnvoyee(cleResume, { until: jour })
      total++
    } catch (error) {
      console.error(`[notifications] Résumé quotidien échoué pour ${user.id}:`, error)
    }
  }
  return total
}
