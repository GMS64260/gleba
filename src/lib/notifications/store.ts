/**
 * Anti-redondance des notifications : store EN MÉMOIRE des alertes déjà
 * envoyées.
 *
 * Chaque clé est propre à (utilisateur, alerte) — le sender préfixe par
 * l'id utilisateur. Les entrées sont purgées dès que leur date de validité
 * (`until`) est dépassée ou après TTL (7 jours), ce qui permet de
 * re-notifier une alerte qui revient (ex. gel une autre nuit).
 *
 * Volontairement sans dépendance : un store en mémoire évite toute migration
 * de schéma Prisma et tout risque sur l'instance en production. Au pire un
 * redémarrage du conteneur peut re-émettre une alerte du jour — acceptable,
 * et le TTL limite l'accumulation.
 */

export interface EntreeAlerteEnvoyee {
  sentAt: number // epoch ms
  /** Date (YYYY-MM-DD) jusqu'à laquelle l'alerte reste « déjà notifiée ». */
  until?: string
}

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

const sentAlerts = new Map<string, EntreeAlerteEnvoyee>()

/** Date du jour locale (YYYY-MM-DD) pour les comparaisons d'expiration. */
function todayKey(): string {
  const now = new Date()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${m}-${d}`
}

/**
 * L'alerte (clé `key`) a-t-elle déjà été notifiée et est-elle encore active ?
 */
export function alerteDejaEnvoyee(key: string): boolean {
  const entry = sentAlerts.get(key)
  if (!entry) return false
  if (entry.until && entry.until < todayKey()) {
    // L'alerte date d'un jour passé → elle ne bloque plus
    sentAlerts.delete(key)
    return false
  }
  return true
}

/** Marque une alerte comme envoyée, avec sa date de validité éventuelle. */
export function marquerAlerteEnvoyee(key: string, options: { until?: string } = {}): void {
  sentAlerts.set(key, { sentAt: Date.now(), until: options.until })
}

/** Purge les entrées expirées ou trop anciennes (appelé à chaque scan). */
export function nettoyerAlertesEnvoyees(): void {
  const today = todayKey()
  for (const [key, entry] of sentAlerts) {
    const expirée = entry.until !== undefined && entry.until < today
    const tropVieille = Date.now() - entry.sentAt > TTL_MS
    if (expirée || tropVieille) sentAlerts.delete(key)
  }
}

/** Nombre d'entrées actuellement mémorisées (diagnostic / tests). */
export function nombreAlertesMemorisees(): number {
  return sentAlerts.size
}

/** Vide le store — réservé aux tests. */
export function resetStorePourTests(): void {
  sentAlerts.clear()
}
