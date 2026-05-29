/**
 * Référentiel communautaire — stats légères par objet, pour enrichir les listes
 * (`?avis=1`). SERVEUR uniquement. La baseline bayésienne est calculée sur tout
 * le scope (`refType` + `refIds` fournis), pas par sous-ensemble.
 */

import type { PrismaClient } from '@prisma/client'
import { type AvisRefType, type AvisStatsListe, type AvisNotable } from './types'
import { calculerStats, moyenneGlobaleNotes } from './stats'
import { rendementReel, badgeTerrain } from './data-driven'
import { criteresKeys } from './criteres'

export async function statsAvisPourRefs(
  prisma: PrismaClient,
  refType: AvisRefType,
  refIds: string[]
): Promise<Map<string, AvisStatsListe>> {
  const result = new Map<string, AvisStatsListe>()
  if (refIds.length === 0) return result

  const [rows, reelMap] = await Promise.all([
    prisma.avis.findMany({
      where: { refType, refId: { in: refIds } },
      select: { refId: true, reprend: true, notes: true },
    }),
    rendementReel(prisma, refType, refIds),
  ])

  const toNotable = (r: { reprend: boolean | null; notes: unknown }): AvisNotable => ({
    reprend: r.reprend,
    notes: (r.notes ?? {}) as Record<string, number | null>,
  })

  const moyenneGenerale = moyenneGlobaleNotes(rows.map(toNotable))
  const keys = criteresKeys(refType)

  const parRef = new Map<string, AvisNotable[]>()
  for (const r of rows) {
    const n = toNotable(r)
    const liste = parRef.get(r.refId)
    if (liste) liste.push(n)
    else parRef.set(r.refId, [n])
  }

  for (const refId of refIds) {
    const stats = calculerStats(parRef.get(refId) ?? [], moyenneGenerale, keys)
    result.set(refId, {
      nbAvis: stats.nbAvis,
      noteMoyenne: stats.noteMoyenne,
      tauxReprise: stats.tauxReprise,
      scoreCommunautaire: stats.scoreCommunautaire,
      badgeTerrain: badgeTerrain(reelMap.get(refId)),
    })
  }
  return result
}
