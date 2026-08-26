/**
 * Scheduler interne au conteneur (node-cron), initialisé au démarrage du
 * serveur Next.js via `src/instrumentation.ts` (register()).
 *
 * - Résumé quotidien : vérifié chaque minute selon les réglages en base.
 * - Surveillance météo + urgences : vérifiée selon l'intervalle configuré en base,
 *   plus un premier scan ~30 s après le boot.
 *
 * Robustesse : l'init est enveloppé en try/catch (ne fait jamais crasher le
 * démarrage) ; chaque run est isolé et ne peut pas se chevaucher avec le
 * précédent.
 */

import cron from "node-cron"
import { doitLancerScan, estHeureResume, getMeteoCronExpression, getMeteoIntervalMinutes, getResumeCronExpression } from "./config"
import {
  envoyerAlertesMeteoTempsReel,
  envoyerAlertesUrgentes,
  envoyerResumeQuotidien,
  notificationsEnabled,
} from "./sender"
import { pushConfigure } from "@/lib/push"
import { getSetting } from "@/lib/settings"

let initialized = false
/** Délai avant le premier scan au démarrage (laisse la DB se réveiller). */
const DELAI_PREMIER_SCAN_MS = 30_000
let scanEnCours = false
let dernierScanMs = 0
let dernierResumeJour: string | null = null

async function runScanMeteoEtUrgent(): Promise<void> {
  if (scanEnCours) {
    console.warn("[notifications] Scan précédent encore en cours, saut de cycle")
    return
  }
  scanEnCours = true
  try {
    const meteo = await envoyerAlertesMeteoTempsReel()
    const urgent = await envoyerAlertesUrgentes()
    if (meteo > 0 || urgent > 0) {
      console.log(`[notifications] Scan météo/urgent: ${meteo} météo + ${urgent} urgentes`)
    }
    dernierScanMs = Date.now()
  } catch (error) {
    console.error("[notifications] Échec du scan météo/urgent:", error)
  } finally {
    scanEnCours = false
  }
}

function getJourDansTimezone(date: Date, timezone: string): string {
  try {
    return date.toLocaleDateString("en-CA", { timeZone: timezone })
  } catch {
    return date.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" })
  }
}

export async function initNotifScheduler(): Promise<void> {
  if (initialized) return
  initialized = true

  try {
    // Configuration push (VAPID) — ne bloque pas le boot si raté.
    try {
      await pushConfigure()
    } catch (error) {
      console.error("[notifications] Vérification de la configuration push impossible:", error)
    }

    // Premier scan météo/urgent ~30 s après le boot
    setTimeout(() => runScanMeteoEtUrgent().catch((error) => console.error("[notifications] Premier scan en échec:", error)), DELAI_PREMIER_SCAN_MS)

    // Scan météo/urgent planifié via cron expression (basée sur les réglages globaux en base)
    // On lit l'intervalle au démarrage et on planifie le cron statique.
    // Pour les changements à chaud, on peut soit re-planifier, soit lire la base à chaque exécution.
    const intervalMinutes = getMeteoIntervalMinutes(process.env)
    const scanExpression = getMeteoCronExpression(process.env)
    const resumeExpression = getResumeCronExpression(process.env)

    cron.schedule(scanExpression, () => runScanMeteoEtUrgent().catch((error) => console.error("[notifications] Scan planifié en échec:", error)))

    // Vérification chaque minute pour appliquer immédiatement les réglages
    // d'heure et de fuseau sans recréer le cron.
    cron.schedule("* * * * *", async () => {
      try {
        const enabled = await getSetting("notif.enabled")
        if (!enabled) return
        const resumeHeure = await getSetting("notif.resumeHeure")
        const timezone = await getSetting("notif.timezone")
        const maintenant = new Date()
        const jour = getJourDansTimezone(maintenant, timezone)
        if (dernierResumeJour !== null && dernierResumeJour !== jour) {
          dernierResumeJour = null
        }
        if (dernierResumeJour === jour || !estHeureResume(maintenant, resumeHeure, timezone)) {
          return
        }
        // Marqué avant l'appel async pour éviter deux envois si un tick
        // démarre avant la fin du précédent.
        dernierResumeJour = jour
        const nombreEnvoyes = await envoyerResumeQuotidien()
        if (nombreEnvoyes > 0) {
          console.log(`[notifications] Résumé quotidien envoyé à ${nombreEnvoyes} destinataire(s)`)
        }
      } catch (error) {
        console.error("[notifications] Résumé quotidien en échec:", error)
      }
    })
    console.log(`[notifications] Scheduler démarré — résumé quotidien à ${resumeExpression} (NOTIF_RESUME_HEURE) — scan météo/urgent toutes les ${intervalMinutes} min (${scanExpression})`)
  } catch (error) {
    console.error("[notifications] Impossible de démarrer le scheduler:", error)
  }
}