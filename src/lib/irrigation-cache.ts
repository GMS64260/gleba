/**
 * Cache en mémoire pour les recommandations d'irrigation
 * TTL : 1 heure — recalcul automatique à la prochaine connexion après expiration
 *
 * Clé : `${userId}_${parcelleId || 'all'}_${jour}` (le jour : après minuit, le
 * bilan de la veille ne sert plus).
 * Stocké dans le process Node.js (partagé entre toutes les requêtes du même worker)
 */

const TTL_MS = 60 * 60 * 1000 // 1 heure

interface CacheEntry<T> {
  data: T
  cachedAt: number // timestamp ms
}

class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>()

  get(key: string): { data: T; cachedAt: Date; ageSeconds: number } | null {
    const entry = this.store.get(key)
    if (!entry) return null

    const ageMs = Date.now() - entry.cachedAt
    if (ageMs > TTL_MS) {
      this.store.delete(key)
      return null
    }

    return {
      data: entry.data,
      cachedAt: new Date(entry.cachedAt),
      ageSeconds: Math.floor(ageMs / 1000),
    }
  }

  set(key: string, data: T): void {
    // Le jour est dans la clé : les entrées des jours passés ne sont plus
    // jamais relues, on les purge ici plutôt que de les garder jusqu'au
    // redémarrage.
    const maintenant = Date.now()
    for (const [cle, entree] of this.store) {
      if (maintenant - entree.cachedAt > TTL_MS) this.store.delete(cle)
    }
    this.store.set(key, { data, cachedAt: maintenant })
  }

  /** Invalide toutes les entrées d'un utilisateur (ex: après une irrigation manuelle) */
  invalidateUser(userId: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(`${userId}_`)) {
        this.store.delete(key)
      }
    }
  }

  /** Retourne le timestamp de mise en cache, ou null si absent/expiré */
  getCachedAt(key: string): Date | null {
    const hit = this.get(key)
    return hit ? hit.cachedAt : null
  }
}

export const irrigationCache = new MemoryCache<unknown>()

export function irrigationCacheKey(userId: string, parcelleId?: string | null, maintenant: Date = new Date()): string {
  const jour = `${maintenant.getFullYear()}-${maintenant.getMonth() + 1}-${maintenant.getDate()}`
  return `${userId}_${parcelleId || 'all'}_${jour}`
}
