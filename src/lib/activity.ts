/**
 * Suivi des jours d'activité (table activity_days)
 * Une ligne par utilisateur et par jour (UTC) où il a utilisé l'application.
 * Alimenté par les helpers d'auth (requireAuth / requireAuthApi) — voir
 * aussi le backfill historique dans la migration 20260714090000_activity_days.
 */

import prisma from "./prisma"

// Dédoublonnage en mémoire : au plus une écriture par utilisateur et par jour.
// Borné par le nombre d'utilisateurs actifs du jour, purgé au changement de jour.
const touched = new Map<string, string>()
let touchedDay = ""

/** Enregistre (fire-and-forget) que l'utilisateur est actif aujourd'hui. */
export function touchActivity(userId: string): void {
  if (!userId) return
  const today = new Date().toISOString().slice(0, 10)

  if (touchedDay !== today) {
    touched.clear()
    touchedDay = today
  }
  if (touched.get(userId) === today) return
  touched.set(userId, today)

  prisma
    .$executeRaw`INSERT INTO activity_days (user_id, day) VALUES (${userId}, ${today}::date) ON CONFLICT DO NOTHING`
    .catch((err) => {
      // On réessaiera au prochain appel (ex : user supprimé entre-temps → FK)
      touched.delete(userId)
      console.error("touchActivity error:", err)
    })
}
