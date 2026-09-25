/**
 * Suppression d'un soin d'élevage, partagée par l'écran (DELETE
 * /api/elevage/soins) et l'assistant (outil delete_soin).
 *
 * Signalement 2026-09-25 : un éleveur ne pouvait effacer un traitement saisi
 * par erreur ni à l'écran ni par l'assistant, alors que la route existait.
 * Les deux chemins passent désormais par cette seule écriture.
 */

import prisma from '@/lib/prisma'
import { deleteAutoEntry } from '@/lib/auto-compta'
import { ciblesAffectees, resyncEcartementLait } from '@/lib/elevage/attente-lait'
import { invalidateKpi } from '@/lib/kpi'

// Fenêtre couverte par un soin (pour cibler le resync) : de sa date à la plus
// lointaine de ses fins d'attente. Bornes filtrées des nulls.
export function fenetreSoin(...dates: (Date | null | undefined)[]): { min: Date; max: Date } | null {
  const ds = dates.filter((x): x is Date => x != null)
  if (ds.length === 0) return null
  const t = ds.map((d) => d.getTime())
  return { min: new Date(Math.min(...t)), max: new Date(Math.max(...t)) }
}

export async function supprimerSoin(userId: string, soinId: number) {
  const existing = await prisma.soinAnimal.findFirst({
    where: { id: soinId, userId },
  })
  if (!existing) return { ok: false as const, status: 404, error: 'Soin non trouvé' }

  // Réintégration recompute-from-truth : on supprime d'abord le soin, puis on
  // recalcule l'écartement sur sa fenêtre et ses cibles (cross-granularité).
  // Les collectes couvertes uniquement par ce soin redeviennent
  // commercialisables ; celles couvertes par un autre soin restent écartées.
  await prisma.$transaction(async (tx) => {
    await deleteAutoEntry('soin_animal', existing.id, 'depense', userId, tx)
    if (existing.stockMedicamentId && existing.quantitePreleveeStock > 0) {
      await tx.stockMedicamentElevage.update({
        where: { id: existing.stockMedicamentId },
        data: { quantite: { increment: existing.quantitePreleveeStock } },
      })
    }
    await tx.soinAnimal.delete({ where: { id: existing.id } })
    if (existing.finAttenteLait) {
      const cibles = await ciblesAffectees(tx, userId, existing.animalId, existing.lotId)
      const f = fenetreSoin(existing.date, existing.finAttenteLait)
      if (f) await resyncEcartementLait(tx, userId, cibles, f.min, f.max)
    }
  })
  invalidateKpi(userId)
  return { ok: true as const, soin: existing }
}
