/**
 * Configuration du scheduler de notifications — PUR, sans aucune dépendance
 * runtime (testable directement, contrairement à scheduler.ts qui tire
 * nodemailer/prisma via sender.ts).
 */

/** Parse « HH:MM » → { hour, minute } ou null si invalide. */
export function parseHeureResume(value: string | undefined): { hour: number; minute: number } | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

/** Expression cron du résumé quotidien (défaut 07:00). */
export function getResumeCronExpression(
  env: Record<string, string | undefined> = process.env
): string {
  const heure = parseHeureResume(env.NOTIF_RESUME_HEURE) ?? { hour: 7, minute: 0 }
  return `${heure.minute} ${heure.hour} * * *`
}

/** Intervalle (minutes) du scan météo — défaut 30, borné [5, 1440]. */
export function getMeteoIntervalMinutes(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = Number.parseInt(env.NOTIF_METEO_INTERVAL_MIN ?? "30", 10)
  if (!Number.isInteger(raw)) return 30
  return Math.min(Math.max(raw, 5), 1440)
}
