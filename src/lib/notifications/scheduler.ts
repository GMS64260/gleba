/**
 * Scheduler interne au conteneur (node-cron), initialisé au démarrage du
 * serveur Next.js via `src/instrumentation.ts` (register()).
 *
 * - Résumé quotidien : vérifié chaque minute selon les réglages en base.
 * - Surveillance météo + urgences : vérifiée selon l'intervalle configuré en base,
 *   plus un premier scan ~30 s après le boot.
 * - Purge du cache persistant (`generic_cache`) : chaque nuit.
 * - Historique climatique SAFRAN : import des mailles demandées, actualisation
 *   chaque nuit (`GLEBA_AGROCLIMAT_IMPORT=false` pour le couper).
 *
 * Robustesse : l'init est enveloppé en try/catch (ne fait jamais crasher le
 * démarrage) ; chaque run est isolé et ne peut pas se chevaucher avec le
 * précédent.
 */

import cron from "node-cron"
import { reconcilierAbonnements } from "@/lib/abonnement/reconciliation"
import { actualiserMailles, importerMaillesDemandees } from "@/lib/agroclimat/import-safran"
import { agregerEtPurgerMesures } from "@/lib/capteurs/agregats"
import { estHeureResume, getMeteoCronExpression, getMeteoIntervalMinutes, getResumeCronExpression } from "./config"
import {
  envoyerAlertesMeteoTempsReel,
  envoyerAlertesUrgentes,
  envoyerResumeQuotidien,
} from "./sender"
import { pushConfigure } from "@/lib/push"
import { getSetting } from "@/lib/settings"
import { purgeExpired } from "@/lib/cache-helper"
import { purgerDonneesExpirees } from "@/lib/retention"

let initialized = false
/** Délai avant le premier scan au démarrage (laisse la DB se réveiller). */
const DELAI_PREMIER_SCAN_MS = 30_000
let scanEnCours = false
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
  // Pendant `next build`, register() peut être exécuté par le serveur de
  // compilation : on ne planifie rien. (Garde présente avant la PR #36 et
  // restaurée à son intégration — sans elle, un build lançait des scans.)
  if (process.env.NEXT_PHASE === "phase-production-build") return

  initialized = true

  try {
    cron.schedule("*/15 * * * *", () => reconcilierAbonnements().catch(() => console.warn("[abonnement] Réconciliation reportée.")))
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

    // Purge du cache persistant, chaque nuit à 03:17 (2026-09-09).
    // `purgeExpired` existait depuis l'origine, annoncé « cron léger », et
    // n'était appelé par PERSONNE : 282 des 322 lignes de `generic_cache`
    // étaient périmées, certaines depuis 28 jours. Rien ne cassait, mais la
    // table ne faisait que croître et les mesures de cache y perdaient leur
    // sens. Heure creuse et minute décalée pour ne croiser aucun autre cron.
    cron.schedule("17 3 * * *", () => {
      purgeExpired()
        .then((supprimees) => {
          if (supprimees > 0) {
            console.log(`[cache] ${supprimees} entrée(s) périmée(s) purgée(s) de generic_cache`)
          }
        })
        .catch((error) => console.error("[cache] Purge de generic_cache en échec:", error))
    })

    // Durées de conservation de /confidentialite (revue du 2026-11-04) :
    // journaux de connexion (12 mois) et consentements aux cookies (13 mois).
    cron.schedule("27 3 * * *", () => {
      purgerDonneesExpirees()
        .then(({ connexions, consentements }) => {
          if (connexions > 0 || consentements > 0) {
            console.log(`[conservation] ${connexions} connexion(s) et ${consentements} consentement(s) au-delà de leur durée purgés`)
          }
        })
        .catch((error) => console.error("[conservation] Purge des données expirées en échec:", error))
    })

    // Capteurs connectés (2026-10-23) : agrégats de tous les jours
    // disponibles du lieu, puis purge du brut au-delà de la rétention. Minute décalée
    // de la purge du cache.
    cron.schedule("47 3 * * *", () => {
      agregerEtPurgerMesures()
        .then(({ agregats, purgees }) => {
          if (agregats > 0 || purgees > 0) {
            console.log(`[capteurs] ${agregats} agrégat(s) journalier(s) recalculé(s), ${purgees} mesure(s) brute(s) purgée(s)`)
          }
        })
        .catch((error) => console.error("[capteurs] Agrégation ou purge des mesures en échec:", error))
    })

    // Historique climatique SAFRAN (2026-11-15). Les mailles demandées par une
    // parcelle sont importées dès la demande ; ce passage toutes les dix
    // minutes rattrape une demande dont l'import a été interrompu (redémarrage,
    // panne réseau). Sans maille en attente, il se réduit à une requête.
    cron.schedule("4-59/10 * * * *", () => {
      importerMaillesDemandees()
        .then(({ mailles, annees }) => {
          if (mailles > 0) console.log(`[agroclimat] ${mailles} maille(s) SAFRAN importée(s), ${annees} année(s) écrite(s)`)
        })
        .catch((error) => console.error("[agroclimat] Import de l'historique SAFRAN en échec:", error))
    })

    // Chaque nuit à 04:07, après la mise à jour quotidienne de Météo-France :
    // les soixante derniers jours des mailles déjà importées.
    cron.schedule("7 4 * * *", () => {
      actualiserMailles()
        .then((mailles) => {
          if (mailles > 0) console.log(`[agroclimat] ${mailles} maille(s) SAFRAN actualisée(s)`)
        })
        .catch((error) => console.error("[agroclimat] Actualisation de l'historique SAFRAN en échec:", error))
    })

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
