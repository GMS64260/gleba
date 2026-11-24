/**
 * Sortie de stock d'une espèce répartie sur ses lots de récolte (modèle de
 * stock unique, lot 2, 2026-11-24).
 *
 * Une sortie saisie dans Consommations, par l'assistant ou le MCP (« 3 kg de
 * carottes donnés ») ne nomme pas de lot. Elle prend les lots LIBRES de
 * l'espèce, dans l'unité du stock, du plus ancien au plus récent (date du lot,
 * puis identifiant), et ne prend jamais un lot récolté après le jour de la
 * sortie. Un écart d'inventaire (comptage), lui, se prend sur les plus récents
 * d'abord : même convention que le catalogue de la caisse, qui donne le stock
 * aux plus anciens. Un lot pris en entier passe au statut de la sortie ; un lot
 * pris en partie est scindé : il GARDE son identité et le reste (et sa
 * réservation de marché éventuelle), une nouvelle ligne porte la part sortie,
 * avec le jour de sortie et le lien vers la consommation.
 *
 * Lots pris : ceux du stock de l'espèce (`chargerIdsRecoltesHorsStock`). D'un
 * lot réservé à un marché, seule la part non réservée sort (L4.1) ; le
 * déclencheur de la caisse fige son identité, pas sa quantité. Un lot déjà lié
 * à un bon, une facture ou une publication (`stockDisponibleCommercial`
 * renseigné, statut figé par `proteger_lot_commercial`) sort par le JOURNAL
 * des mouvements, comme au verger : son reste baisse, le mouvement garde la
 * nature de la sortie et la clé de la consommation ou du comptage.
 *
 * Ce qu'aucun lot ne couvre (part réservée au marché, lots récoltés après la
 * sortie) est rendu à l'appelant (`horsLots`) : une sortie de Consommations est
 * alors refusée, un comptage aussi (L4.1).
 *
 * À appeler dans une transaction qui tient déjà `verrouillerStockCommercial`.
 */
import type { Prisma } from '@prisma/client'
import { quantitesCaisse } from '@/lib/caisse/reservations'
import { chargerIdsRecoltesHorsStock } from '@/lib/stocks-helpers'
import { restituerAuLot } from '@/lib/stocks/milliemes-sql'
import { retirerDuStock } from '@/lib/stocks/milliemes'
import { jourSortie } from '@/lib/recolte/sortie-lot'
import type { StatutSortieLot } from '@/lib/validations/recolte'
import type { UniteQuantite } from '@/lib/recolte/projection'

type Tx = Prisma.TransactionClient

const EPSILON = 1e-9
const auMillieme = (q: number) => Math.round(q * 1000) / 1000

export interface LotSorti {
  /** Ligne qui porte la part sortie : le lot lui-même s'il sort en entier. */
  id: number
  quantite: number
  /** Lot d'origine, resté en stock avec le reste, s'il a été scindé. */
  reliquatId: number | null
  /** Lot lié à un document : mouvement du journal qui porte la sortie. */
  mouvementId?: string
}

/** Clé du mouvement d'une sortie de lot lié : celle de sa consommation, ou de son comptage. */
export function cleSortieLot(consommationId: number | null, date: Date, lotId: number): string {
  return consommationId != null ? `consommation:${consommationId}:lot:${lotId}` : `comptage:${date.getTime()}:lot:${lotId}`
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
    statut: StatutSortieLot
    /** Sortie de Consommations qui prend les lots ; null pour un écart d'inventaire. */
    consommationId: number | null
    /** Écart d'inventaire : lots datés au plus tard à cet INSTANT (le comptage), pas au jour. */
    dateMax?: Date
    /** Ordre de prise : les plus anciens d'abord (défaut), ou les plus récents (écart d'inventaire). */
    ordre?: 'anciens' | 'recents'
  },
): Promise<SortieParLots> {
  const jour = jourSortie(sortie.date)
  const horsStock = await chargerIdsRecoltesHorsStock(userId, tx)
  const candidats = await tx.recolte.findMany({
    where: {
      userId,
      especeId: sortie.especeId,
      statut: 'en_stock',
      ...(horsStock.length > 0 && { id: { notIn: horsStock } }),
      ...(sortie.unite === 'kg' ? { OR: [{ unite: 'kg' }, { unite: null }] } : { unite: sortie.unite }),
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    select: {
      id: true, quantite: true, unite: true, date: true, cultureId: true, especeId: true,
      datePeremption: true, statutBioSnapshot: true, notes: true, createdAt: true, stockDisponibleCommercial: true,
    },
  })
  const reserves = candidats.length ? await quantitesCaisse(tx, userId) : new Map<string, number>()
  const reserveDe = (l: { id: number; unite: string | null }) => reserves.get(`recolte:${l.id}:${l.unite ?? 'kg'}`) ?? 0
  const reste = (l: { quantite: number; stockDisponibleCommercial: number | null }) => l.stockDisponibleCommercial ?? l.quantite
  const lots = candidats.filter(
    (l) => (sortie.dateMax ? l.date <= sortie.dateMax : jourSortie(l.date) <= jour)
      && reste(l) - reserveDe(l) > EPSILON,
  )
  if (sortie.ordre === 'recents') lots.reverse()
  if (lots.length) {
    await tx.$queryRaw`SELECT id FROM recoltes WHERE id = ANY(${lots.map((l) => l.id)}::int[]) AND user_id = ${userId} FOR UPDATE`
  }

  let restant = sortie.quantite
  const sortis: LotSorti[] = []
  for (const lot of lots) {
    if (restant <= EPSILON) break
    const reserve = reserveDe(lot)
    const libre = reserve > EPSILON ? auMillieme(reste(lot) - reserve) : reste(lot)
    const prise = restant + EPSILON < libre ? auMillieme(restant) : libre
    const marque = { statut: sortie.statut, dateSortie: sortie.date, consommationId: sortie.consommationId }
    if (lot.stockDisponibleCommercial != null) {
      // Lot lié à un document : sortie par le journal. Un écart d'inventaire est
      // saisi à l'instant du comptage, qui le compte déjà (`dateEffetStockCommercial`).
      const mouvement = await tx.mouvementStockCommercial.create({
        data: {
          userId, nature: sortie.statut, recolteId: lot.id, articleStockType: 'recolte', articleStockId: String(lot.id),
          sourceNom: `Récolte #${lot.id}`, unite: lot.unite ?? 'kg', quantite: prise, date: sortie.date,
          cleIdempotence: cleSortieLot(sortie.consommationId, sortie.date, lot.id),
          ...(sortie.consommationId == null ? { createdAt: sortie.date } : {}),
        },
        select: { id: true },
      })
      await tx.recolte.update({ where: { id: lot.id }, data: { stockDisponibleCommercial: retirerDuStock(lot.stockDisponibleCommercial, prise) } })
      sortis.push({ id: lot.id, quantite: prise, reliquatId: null, mouvementId: mouvement.id })
    } else if (reserve <= EPSILON && Math.abs(prise - lot.quantite) <= EPSILON) {
      await tx.recolte.update({ where: { id: lot.id }, data: marque })
      sortis.push({ id: lot.id, quantite: prise, reliquatId: null })
    } else {
      // La part sortie d'abord (hors stock), puis le lot réduit : le stock de
      // l'espèce ne passe jamais, entre deux écritures, sous ce qu'il vaudra à
      // la fin (les gardes de la caisse le contrôlent à chaque ligne). Même
      // date ET même instant de saisie que le lot : la part garde son histoire.
      const part = await tx.recolte.create({
        data: {
          userId, especeId: lot.especeId, cultureId: lot.cultureId, date: lot.date, createdAt: lot.createdAt,
          quantite: prise, unite: lot.unite, ...marque,
          datePeremption: lot.datePeremption, statutBioSnapshot: lot.statutBioSnapshot,
          notes: lot.notes ?? `Part sortie de la récolte #${lot.id}`,
        },
        select: { id: true },
      })
      await tx.recolte.update({ where: { id: lot.id }, data: { quantite: auMillieme(lot.quantite - prise) } })
      sortis.push({ id: part.id, quantite: prise, reliquatId: lot.id })
    }
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
  // Lots liés à un document : le mouvement est retiré, sa quantité revient au reste.
  const mouvements = await tx.mouvementStockCommercial.findMany({
    where: { userId, recolteId: { not: null }, cleIdempotence: { startsWith: `consommation:${consommationId}:lot:` } },
    select: { id: true, recolteId: true, quantite: true },
  })
  for (const m of mouvements) {
    await tx.mouvementStockCommercial.delete({ where: { id: m.id } })
    await restituerAuLot(tx, userId, 'recolte', m.recolteId!, m.quantite)
  }
  return count + mouvements.length
}
