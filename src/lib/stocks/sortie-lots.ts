/**
 * Sortie de stock d'une espèce répartie sur ses lots de récolte (modèle de
 * stock unique, lot 2, 2026-11-24).
 *
 * Une sortie saisie dans Consommations, par l'assistant ou le MCP (« 3 kg de
 * carottes donnés ») ne nomme pas de lot. Elle prend les lots LIBRES de
 * l'espèce, dans l'unité du stock, du plus ancien au plus récent (date du lot,
 * puis identifiant), et ne prend jamais un lot récolté après le jour de la
 * sortie. Chaque lot pris passe au statut de la sortie (perte, consommation
 * personnelle, don) avec son jour de sortie et le lien vers la consommation ;
 * un lot pris en partie est scindé comme par la vente partielle : la part
 * sortie garde la ligne, le reste redevient un lot en stock.
 *
 * Lots libres : en stock, jamais entamés par un bon, une facture ou une
 * publication (`stockDisponibleCommercial` nul), sans produit de la boutique,
 * non réservés à un marché. Les autres se sortent par leur document.
 *
 * Ce qu'aucun lot ne couvre (stock compté sans lot, lots réservés) est rendu à
 * l'appelant (`horsLots`) : il reste retranché du stock de l'espèce par la
 * consommation, comme avant ce lot.
 *
 * À appeler dans une transaction qui tient déjà `verrouillerStockCommercial`.
 */
import type { Prisma } from '@prisma/client'
import { quantitesCaisse } from '@/lib/caisse/reservations'
import { jourSortie } from '@/lib/recolte/sortie-lot'
import type { StatutSortieRecolte } from '@/lib/validations/recolte'
import type { UniteQuantite } from '@/lib/recolte/projection'

type Tx = Prisma.TransactionClient

const EPSILON = 1e-9
const auMillieme = (q: number) => Math.round(q * 1000) / 1000

export interface LotSorti {
  id: number
  quantite: number
  /** Identifiant du lot créé pour le reste du lot, s'il a été scindé. */
  reliquatId: number | null
}

export interface SortieParLots {
  couvert: number
  horsLots: number
  lots: LotSorti[]
}

export async function sortirParLots(
  tx: Tx,
  userId: string,
  sortie: {
    especeId: string
    unite: UniteQuantite
    quantite: number
    /** Date enregistrée de la sortie (`instantSortie`). */
    date: Date
    statut: StatutSortieRecolte
    consommationId: number
  },
): Promise<SortieParLots> {
  const jour = jourSortie(sortie.date)
  const candidats = await tx.recolte.findMany({
    where: {
      userId,
      especeId: sortie.especeId,
      statut: 'en_stock',
      stockDisponibleCommercial: null,
      produitsBoutique: { none: {} },
      ...(sortie.unite === 'kg' ? { OR: [{ unite: 'kg' }, { unite: null }] } : { unite: sortie.unite }),
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: {
      id: true, quantite: true, unite: true, date: true, cultureId: true, especeId: true,
      datePeremption: true, statutBioSnapshot: true, notes: true,
    },
  })
  const reserves = candidats.length ? await quantitesCaisse(tx, userId) : new Map<string, number>()
  const lots = candidats.filter(
    (l) => jourSortie(l.date) <= jour && l.quantite > EPSILON && !reserves.get(`recolte:${l.id}:${l.unite ?? 'kg'}`),
  )
  if (lots.length) {
    await tx.$queryRaw`SELECT id FROM recoltes WHERE id = ANY(${lots.map((l) => l.id)}::int[]) AND user_id = ${userId} FOR UPDATE`
  }

  let restant = sortie.quantite
  const sortis: LotSorti[] = []
  for (const lot of lots) {
    if (restant <= EPSILON) break
    const sortiePartielle = restant + EPSILON < lot.quantite
    const prise = sortiePartielle ? auMillieme(restant) : lot.quantite
    const marque = { statut: sortie.statut, dateSortie: sortie.date, consommationId: sortie.consommationId }
    let reliquatId: number | null = null
    if (sortiePartielle) {
      // Le reste d'abord, comme la vente partielle : le stock de l'espèce ne
      // passe jamais, entre deux écritures, sous ce qu'il vaudra à la fin (les
      // gardes de la caisse le contrôlent à chaque ligne).
      const reliquat = await tx.recolte.create({
        data: {
          userId, especeId: lot.especeId, cultureId: lot.cultureId, date: lot.date,
          quantite: auMillieme(lot.quantite - prise), unite: lot.unite, statut: 'en_stock',
          datePeremption: lot.datePeremption, statutBioSnapshot: lot.statutBioSnapshot,
          // Le reste est le même produit : il garde la note du lot.
          notes: lot.notes ?? `Reliquat de la récolte #${lot.id}`,
        },
        select: { id: true },
      })
      reliquatId = reliquat.id
      await tx.recolte.update({ where: { id: lot.id }, data: { ...marque, quantite: prise } })
    } else {
      await tx.recolte.update({ where: { id: lot.id }, data: marque })
    }
    sortis.push({ id: lot.id, quantite: prise, reliquatId })
    restant = auMillieme(restant - prise)
  }

  const horsLots = restant > EPSILON ? auMillieme(restant) : 0
  return { couvert: auMillieme(sortie.quantite - horsLots), horsLots, lots: sortis }
}

/**
 * Rend au stock les lots qu'une consommation a sortis, à son annulation. Seuls
 * ceux qui portent encore son statut de sortie reviennent : un lot remis en
 * stock puis vendu entre-temps n'est pas touché. Le reste d'une scission reste
 * un lot distinct (comme après une vente partielle annulée).
 */
export async function rendreLotsConsommation(tx: Tx, userId: string, consommationId: number): Promise<number> {
  const { count } = await tx.recolte.updateMany({
    where: { userId, consommationId, statut: { in: ['perte', 'consomme', 'don'] } },
    data: { statut: 'en_stock', dateSortie: null, consommationId: null },
  })
  return count
}
