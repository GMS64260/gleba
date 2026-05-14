/**
 * Helper de cache persistant (PROMPT 25 LOT A).
 *
 * Utilise la table `generic_cache` : { key, data (JSON), expires_at }.
 * Permet de remplacer les caches en mémoire (Map JavaScript) qui se
 * vident au redémarrage Docker, tout en gardant une API similaire.
 *
 * Usage :
 *   const data = await getOrFetch(`soilgrids:${lat},${lng}`,
 *     () => fetchSoilGrids(lat, lng),
 *     30 * 24 * 60 * 60_000) // TTL 30 jours
 */

import prisma from "@/lib/prisma"

export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  // 1. Cache hit ?
  const now = new Date()
  const cached = await prisma.genericCache.findUnique({ where: { key } })
  if (cached && cached.expiresAt > now) {
    return cached.data as T
  }

  // 2. Cache miss ou expiré : on appelle le fetcher
  let value: T
  try {
    value = await fetcher()
  } catch (err) {
    // Si le fetcher échoue et qu'on a une valeur expirée, mieux vaut renvoyer
    // l'ancienne que rien — l'utilisateur s'attend à des données, même périmées
    if (cached) {
      console.warn(`[cache-helper] fetcher failed for ${key}, returning stale cache`)
      return cached.data as T
    }
    throw err
  }

  // 3. On persiste (upsert pour gérer la concurrence)
  const expiresAt = new Date(now.getTime() + ttlMs)
  await prisma.genericCache.upsert({
    where: { key },
    create: { key, data: value as any, expiresAt },
    update: { data: value as any, expiresAt },
  })
  return value
}

/** Invalide manuellement une clé (rarement nécessaire). */
export async function invalidate(key: string): Promise<void> {
  await prisma.genericCache.deleteMany({ where: { key } })
}

/** Purge automatique des entrées expirées (cron léger). */
export async function purgeExpired(): Promise<number> {
  const r = await prisma.genericCache.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  return r.count
}
