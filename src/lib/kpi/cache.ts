/**
 * Cache mémoire pour la couche KPI (TTL 5 minutes).
 *
 * - Clé : `${prefix}:${userId}:${year}:${asOfDayKey}`
 * - Invalidation explicite via `invalidateKpi(userId)` à appeler depuis toute
 *   route API qui mute des données contribuant aux KPI.
 *
 * Implémentation volontairement minimale (Map en mémoire). Suffisant pour un
 * déploiement mono-process. En cas de scale horizontal, basculer sur Redis.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

type Entry<T> = {
  value: T
  expiresAt: number
}

const store = new Map<string, Entry<unknown>>()

export function asOfDayKey(asOf: Date): string {
  return `${asOf.getFullYear()}-${asOf.getMonth() + 1}-${asOf.getDate()}`
}

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (entry.expiresAt < Date.now()) {
    store.delete(key)
    return undefined
  }
  return entry.value as T
}

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

/**
 * Invalide TOUTES les entrées du cache pour un utilisateur. À appeler depuis
 * les routes API qui modifient cultures, récoltes, planches, ventes, dépenses,
 * factures, etc. — bref, toute donnée mutée qui contribue aux KPI.
 */
export function invalidateKpi(userId: string): void {
  const suffix = `:${userId}:`
  for (const key of store.keys()) {
    if (key.includes(suffix)) {
      store.delete(key)
    }
  }
}

/** Vide intégralement le cache (utile pour les tests). */
export function clearKpiCache(): void {
  store.clear()
}

/**
 * Wrap mémoïsation : si une valeur fraîche existe pour `key`, la retourne ;
 * sinon, exécute `compute` et met le résultat en cache.
 */
export async function memoize<T>(
  key: string,
  compute: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const cached = getCached<T>(key)
  if (cached !== undefined) return cached
  const value = await compute()
  setCached(key, value, ttlMs)
  return value
}
