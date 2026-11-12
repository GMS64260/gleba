/**
 * Suppression d'un soin d'élevage, partagée par l'écran (DELETE
 * /api/elevage/soins) et l'assistant (outil delete_soin).
 *
 * Signalement 2026-09-25 : un éleveur ne pouvait effacer un traitement saisi
 * par erreur ni à l'écran ni par l'assistant, alors que la route existait.
 * Les deux chemins passent désormais par cette seule écriture.
 *
 * C9 (revue réglementaire du 2026-11-12) : un soin ADMINISTRÉ ne se supprime
 * plus sans trace. Voir `annulation-soin.ts` : refus pour une administration
 * réelle ; pour une erreur de saisie motivée, l'original est journalisé avant
 * l'effacement. Un soin seulement planifié se supprime comme avant.
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { estLotMedicamentAuRebut } from '@/lib/elevage/stock-medicament'
import { deleteAutoEntry } from '@/lib/auto-compta'
import { ciblesLaitAffectees, resyncEcartementLait } from '@/lib/elevage/attente-lait'
import { invalidateKpi } from '@/lib/kpi'
import { controlerAnnulation, journaliserAnnulationSoin, soinAdministre } from '@/lib/elevage/annulation-soin'

// Fenêtre couverte par un soin (pour cibler le resync) : de sa date à la plus
// lointaine de ses fins d'attente. Bornes filtrées des nulls.
export function fenetreSoin(...dates: (Date | null | undefined)[]): { min: Date; max: Date } | null {
  const ds = dates.filter((x): x is Date => x != null)
  if (ds.length === 0) return null
  const t = ds.map((d) => d.getTime())
  return { min: new Date(Math.min(...t)), max: new Date(Math.max(...t)) }
}

/**
 * Rend à un lot de pharmacie les doses d'un soin supprimé ou rouvert, sauf si
 * le lot a été mis au rebut entre-temps (rien ne retourne dans un lot jeté).
 */
export async function restituerPrelevement(
  tx: Prisma.TransactionClient,
  userId: string,
  stockMedicamentId: string,
  quantite: number,
): Promise<void> {
  const lot = await tx.stockMedicamentElevage.findFirst({
    where: { id: stockMedicamentId, userId },
    select: { quantite: true, notes: true },
  })
  if (!lot || estLotMedicamentAuRebut(lot)) return
  await tx.stockMedicamentElevage.update({
    where: { id: stockMedicamentId },
    data: { quantite: { increment: quantite } },
  })
}

export interface OptionsSuppressionSoin {
  /** Nature et motif, exigés pour un soin administré (`controlerAnnulation`). */
  annulation?: unknown
  /** Personne connectée qui supprime ; le titulaire du compte par défaut. */
  acteurId?: string
}

export async function supprimerSoin(userId: string, soinId: number, options: OptionsSuppressionSoin = {}) {
  const existing = await prisma.soinAnimal.findFirst({
    where: { id: soinId, userId },
  })
  if (!existing) return { ok: false as const, status: 404, error: 'Soin non trouvé' }

  const injections = await prisma.injectionSoin.findMany({
    where: { soinId, userId },
    orderBy: { numero: 'asc' },
    select: { numero: true, datePrevue: true, dateRealisee: true, statut: true },
  })
  const administre = soinAdministre(existing, injections)
  let demande: ReturnType<typeof controlerAnnulation> | null = null
  if (administre) {
    demande = controlerAnnulation(options.annulation)
    if (!demande.ok) return demande
  }

  // Réintégration recompute-from-truth : on supprime d'abord le soin, puis on
  // recalcule l'écartement sur sa fenêtre et ses cibles (cross-granularité).
  // Les collectes couvertes uniquement par ce soin redeviennent
  // commercialisables ; celles couvertes par un autre soin restent écartées.
  // Ce n'est juste que parce que le soin n'a jamais été administré (erreur de
  // saisie déclarée) : un soin administré est refusé plus haut.
  await prisma.$transaction(async (tx) => {
    if (demande?.ok) {
      await journaliserAnnulationSoin(tx, {
        userId,
        acteurId: options.acteurId ?? userId,
        soinId: existing.id,
        action: 'suppression',
        demande: demande.demande,
        injections,
      })
    }
    await deleteAutoEntry('soin_animal', existing.id, 'depense', userId, tx)
    if (existing.stockMedicamentId && existing.quantitePreleveeStock > 0) {
      await restituerPrelevement(tx, userId, existing.stockMedicamentId, existing.quantitePreleveeStock)
    }
    await tx.soinAnimal.delete({ where: { id: existing.id } })
    if (existing.finAttenteLait) {
      const cibles = await ciblesLaitAffectees(tx, userId, existing.animalId, existing.lotId)
      const f = fenetreSoin(existing.date, existing.finAttenteLait)
      if (f) await resyncEcartementLait(tx, userId, cibles, f.min, f.max)
    }
  })
  invalidateKpi(userId)
  return { ok: true as const, soin: existing }
}
