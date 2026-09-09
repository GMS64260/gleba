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

/**
 * POSTREVIEW Sprint 7 — Limite stale-while-error : on accepte de servir
 * une valeur périmée si l'origin échoue, mais pas indéfiniment.
 * Borné à 24 h après expiresAt.
 */
const STALE_GRACE_MS = 24 * 60 * 60 * 1000

/**
 * Recul après échec de l'origine (2026-09-09).
 *
 * Constat : 293 échecs Open-Meteo en cinq jours, en hausse continue (5 le
 * 05/09, puis 43, 92, 103, 73), plus un `429 Too Many Requests` sur l'endpoint
 * archive. La cause n'était pas le volume nominal — le TTL de 30 min borne déjà
 * les appels — mais l'ABSENCE DE RECUL : en cas d'échec, `expiresAt` n'était
 * pas repoussé (à raison, sinon la grâce de 24 h s'étendrait indéfiniment),
 * donc la clé restait périmée et CHAQUE requête suivante rappelait une origine
 * qu'on savait en panne. Une origine défaillante était donc sollicitée au
 * rythme du trafic entrant, ce qui finit par déclencher le bridage qui prolonge
 * la panne.
 *
 * Le recul vit en mémoire et NON dans `expiresAt` : la borne des 24 h de grâce
 * doit rester calculée sur la vraie date de péremption. Le perdre au
 * redémarrage est sans conséquence — au pire on retente une fois.
 */
const COOLDOWN_ECHEC_MS = 5 * 60 * 1000

/** Au-delà, on élague les reculs expirés : les clés d'archive sont datées. */
const MAX_COOLDOWNS = 500

type ReculEchec = { jusqua: number; erreur: unknown }

/** Clés dont l'origine vient d'échouer : ne pas la rappeler avant `jusqua`. */
const reculs = new Map<string, ReculEchec>()

/**
 * Appels d'origine en cours, par clé. Deux requêtes concurrentes sur une clé
 * périmée déclenchaient deux appels identiques ; elles partagent désormais le
 * même. Sans cela, le recul ci-dessus ne protège pas d'une rafale simultanée.
 */
const enVol = new Map<string, Promise<unknown>>()

function elaguerReculs(maintenantMs: number): void {
  if (reculs.size <= MAX_COOLDOWNS) return
  for (const [cle, recul] of reculs) {
    if (recul.jusqua <= maintenantMs) reculs.delete(cle)
  }
}

export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  // 1. Cache hit ?
  const now = new Date()
  const nowMs = now.getTime()
  const cached = await prisma.genericCache.findUnique({ where: { key } })
  if (cached && cached.expiresAt > now) {
    return cached.data as T
  }

  // Périmé, mais encore dans la fenêtre de grâce : servable si l'origine flanche.
  const staleServable = Boolean(cached && cached.expiresAt.getTime() + STALE_GRACE_MS > nowMs)

  // 2. Origine en recul : on ne la rappelle pas, on sert le périmé ou on
  //    échoue tout de suite avec la cause mémorisée (échouer vite vaut mieux
  //    qu'attendre un timeout dont on connaît déjà l'issue).
  const recul = reculs.get(key)
  if (recul && recul.jusqua > nowMs) {
    if (staleServable) return cached!.data as T
    throw recul.erreur
  }

  // 3. Un seul appel d'origine par clé à la fois.
  let vol = enVol.get(key) as Promise<T> | undefined
  if (!vol) {
    vol = chargerEtPersister(key, fetcher, ttlMs)
    enVol.set(key, vol)
    const nettoyer = () => {
      if (enVol.get(key) === vol) enVol.delete(key)
    }
    // `then(ok, ko)` plutôt que `finally` : la chaîne de nettoyage ne doit
    // jamais laisser un rejet non traité quand l'origine échoue.
    void vol.then(nettoyer, nettoyer)
  }

  try {
    const value = await vol
    reculs.delete(key)
    return value
  } catch (err) {
    // La cause fait partie du message : sans elle, un échec horaire répété
    // (Open-Meteo, 2026-08-31 → 2026-09-02) restait indéchiffrable — timeout,
    // 429 ou réponse malformée se lisaient pareil.
    const cause = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    // Relu APRÈS l'attente, pas à l'entrée : deux appelants concurrents sur la
    // même clé voyaient tous deux « aucun recul » et journalisaient chacun.
    const apres = Date.now()
    const reculCourant = reculs.get(key)
    const dejaEnRecul = Boolean(reculCourant && reculCourant.jusqua > apres)
    elaguerReculs(apres)
    reculs.set(key, { jusqua: apres + COOLDOWN_ECHEC_MS, erreur: err })

    if (staleServable) {
      // Un seul journal par fenêtre de recul : c'est ce qui ramène 293 lignes
      // par cinq jours à une par panne et par clé.
      if (!dejaEnRecul) {
        console.warn(
          `[cache-helper] fetcher failed for ${key} (${cause}), returning stale cache (< 24h), ` +
            `origine en recul ${COOLDOWN_ECHEC_MS / 60_000} min`
        )
      }
      return cached!.data as T
    }
    throw err
  }
}

/** Appelle l'origine et persiste le résultat. Rejette si l'origine échoue. */
async function chargerEtPersister<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  const value = await fetcher()
  const expiresAt = new Date(Date.now() + ttlMs)
  await prisma.genericCache.upsert({
    where: { key },
    create: { key, data: value as any, expiresAt },
    update: { data: value as any, expiresAt },
  })
  return value
}

/** Invalide manuellement une clé (rarement nécessaire). */
export async function invalidate(key: string): Promise<void> {
  reculs.delete(key)
  await prisma.genericCache.deleteMany({ where: { key } })
}

/**
 * Purge automatique des entrées expirées (cron léger, branché sur le scheduler
 * depuis le 2026-09-09).
 *
 * Elle ne supprime PAS tout ce qui est périmé : une entrée périmée depuis moins
 * de `STALE_GRACE_MS` est encore la seule chose servable si l'origine flanche
 * (stale-while-error). La purger reviendrait à transformer une panne d'origine
 * en erreur pour l'utilisateur, alors que le mécanisme existe précisément pour
 * l'éviter. On ne retire donc que ce qui est déjà hors de toute grâce.
 */
export async function purgeExpired(): Promise<number> {
  const limite = new Date(Date.now() - STALE_GRACE_MS)
  const r = await prisma.genericCache.deleteMany({ where: { expiresAt: { lt: limite } } })
  return r.count
}

/** Remise à zéro des états en mémoire — tests uniquement. */
export function __resetEtatsMemoire(): void {
  reculs.clear()
  enVol.clear()
}
