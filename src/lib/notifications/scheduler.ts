/**
 * Scheduler interne au conteneur (node-cron), initialisé au démarrage du
 * serveur Next.js via `src/instrumentation.ts` (register()).
 *
 * - Résumé quotidien : horaire fixe NOTIF_RESUME_HEURE (défaut 07:00).
 * - Surveillance météo + urgences : toutes les NOTIF_METEO_INTERVAL_MIN
 *   minutes (défaut 30), plus un premier scan ~30 s après le boot.
 *
 * Robustesse : l'init est enveloppé en try/catch (ne fait jamais crasher le
 * démarrage) ; chaque run est isolé et ne peut pas se chevaucher avec le
 * précédent.
 */

import cron from "node-cron"
import { getMeteoCronExpression, getMeteoIntervalMinutes, getResumeCronExpression } from "./config"
import { envoyerAlertesMeteoTempsReel, envoyerAlertesUrgentes, envoyerResumeQuotidien, notificationsEnabled } from "./sender"
import { pushConfigure } from "@/lib/push"

let initialized = false

/** Délai avant le premier scan au démarrage (laisse la DB se réveiller). */
const DELAI_PREMIER_SCAN_MS = 30_000

let scanEnCours = false

async function runScanMeteoEtUrgent(): Promise<void> {
  if (scanEnCours) {
    console.warn("[notifications] Scan précédent encore en cours, saut de cycle")
    return
  }
  scanEnCours = true
  try {
    const meteo = await envoyerAlertesMeteoTempsReel()
    const urgentes = await envoyerAlertesUrgentes()
    if (meteo > 0 || urgentes > 0) {
      console.log(`[notifications] Scan : ${meteo} alerte(s) météo, ${urgentes} action(s) urgente(s) envoyée(s)`)
    }
  } catch (error) {
    console.error("[notifications] Échec du scan météo/urgent:", error)
  } finally {
    scanEnCours = false
  }
}

/**
 * Initialise le scheduler. Appelé une seule fois (module-level flag) depuis
 * instrumentation.register(). Ne lève jamais.
 */
export function initNotifScheduler(): void {
  if (initialized) return
  // Pendant `next build`, register() peut être exécuté par le serveur de
  // compilation : on ne planifie rien.
  if (process.env.NEXT_PHASE === "phase-production-build") return

  initialized = true
  try {
    if (!notificationsEnabled()) {
      console.log(
        "[notifications] Désactivées — définir SMTP_HOST/SMTP_USER (ou NOTIF_ENABLED=true après configuration SMTP)"
      )
      return
    }

    if (!pushConfigure()) {
      console.log("[notifications] Push désactivé — définir VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY")
    }

    const intervalMinutes = getMeteoIntervalMinutes()
    const scanExpression = getMeteoCronExpression()
    const resumeExpression = getResumeCronExpression()

    // Premier scan au démarrage (météo + urgences), après un court délai.
    setTimeout(() => {
      runScanMeteoEtUrgent().catch((error) => console.error("[notifications] Premier scan en échec:", error))
    }, DELAI_PREMIER_SCAN_MS)

    // Surveillance météo + urgences à intervalle régulier.
    cron.schedule(scanExpression, () => {
      runScanMeteoEtUrgent().catch((error) => console.error("[notifications] Scan planifié en échec:", error))
    })

    // Résumé quotidien à l'heure configurée (fuseau du conteneur, TZ).
    cron.schedule(
      resumeExpression,
      () => {
        envoyerResumeQuotidien()
          .then((n) => {
            if (n > 0) console.log(`[notifications] Résumé quotidien envoyé à ${n} destinataire(s)`)
          })
          .catch((error) => console.error("[notifications] Résumé quotidien en échec:", error))
      },
      { timezone: process.env.TZ || "Europe/Paris" }
    )

    console.log(
      `[notifications] Scheduler démarré — résumé quotidien à ${resumeExpression} (NOTIF_RESUME_HEURE) — scan météo/urgent toutes les ${intervalMinutes} min (${scanExpression})`
    )
  } catch (error) {
    console.error("[notifications] Impossible de démarrer le scheduler:", error)
  }
}
