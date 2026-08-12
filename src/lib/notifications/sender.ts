/**
 * Orchestration des envois : résumé quotidien + alertes temps réel.
 *
 * Chaque exécution est isolée (try/catch par utilisateur et par étape) :
 * une erreur de météo, de SMTP ou de base ne fait jamais tomber le cron.
 * L'anti-redondance (store en mémoire) est scellée par utilisateur pour
 * que chaque compte reçoive bien ses propres alertes.
 */

import { sendMail } from "@/lib/mail"
import {
  chargerTachesDuJour,
  chargerTachesItpSemaine,
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
import { fetchOpenMeteoForecast } from "@/lib/meteo"

/** Nombre maximal d'emails envoyés par utilisateur et par scan (anti-spam). */
const MAX_EMAILS_PAR_UTILISATEUR = 15

/** Les notifications sont-elles activées ? (défaut : oui si SMTP configuré). */
export function notificationsEnabled(): boolean {
  if (process.env.NOTIF_ENABLED === "false") return false
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER)
}

/**
 * Scan météo temps réel : pour chaque utilisateur, détecte les conditions
 * dangereuses sur les 48 h à venir et email chaque nouvelle alerte.
 */
export async function envoyerAlertesMeteoTempsReel(): Promise<number> {
  if (!notificationsEnabled()) return 0
  nettoyerAlertesEnvoyees()
  const users = await getDestinatairesNotifications()
  let total = 0
  for (const user of users) {
    try {
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

  const alertes: AlerteMeteoNotification[] = []
  for (const { lat, lng } of coords) {
    try {
      const { current, daily } = await fetchOpenMeteoForecast(lat, lng)
      // Temps réel = conditions actuelles + 48 h (gel de la nuit, canicule du lendemain…)
      alertes.push(...detecterAlertesMeteo(daily, current, { horizonJours: 2 }))
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
      const { subject, html } = alerteMeteoEmail(user, alerte)
      await sendMail({ to: user.email, subject, html })
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
  if (!notificationsEnabled()) return 0
  const users = await getDestinatairesNotifications()
  let total = 0
  for (const user of users) {
    try {
      const urgentes = await detecterAlertesUrgentes(user.id)
      let envoyees = 0
      for (const alerte of urgentes) {
        if (envoyees >= MAX_EMAILS_PAR_UTILISATEUR) {
          console.warn(`[notifications] Cap anti-spam atteint pour ${user.email}`)
          break
        }
        const cle = `${user.id}:${alerte.key}`
        if (alerteDejaEnvoyee(cle)) continue
        try {
          const { subject, html } = alerteUrgenteEmail(user, alerte)
          await sendMail({ to: user.email, subject, html })
          marquerAlerteEnvoyee(cle)
          envoyees++
        } catch (error) {
          console.error(`[notifications] Envoi alerte urgente échoué pour ${user.email}:`, error)
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
  if (!notificationsEnabled()) return 0
  const users = await getDestinatairesNotifications()
  let total = 0
  for (const user of users) {
    try {
      const [taches, alertesMeteo, tachesItpSemaine] = await Promise.all([
        chargerTachesDuJour(user.id),
        recupererAlertesMeteoJour(user.id),
        chargerTachesItpSemaine(user.id),
      ])
      const resume = construireResume(taches, alertesMeteo, { tachesItpSemaine })
      const { subject, html } = resumeQuotidienEmail(user, resume)
      await sendMail({ to: user.email, subject, html })
      total++
    } catch (error) {
      console.error(`[notifications] Résumé quotidien échoué pour ${user.email}:`, error)
    }
  }
  return total
}
