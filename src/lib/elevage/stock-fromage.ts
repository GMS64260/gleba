import type { Prisma } from '@prisma/client'
import { EPSILON_KG, stockLotFromage, type StockLotFromage } from './cave-fromage'

export class StockFromageError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message)
    this.name = 'StockFromageError'
  }
}

/** Lot de cave tel que Prisma le rend (poids en Decimal), avec ses sorties. */
type LotAvecSorties = {
  nbPieces: number
  poidsTotalKg: Prisma.Decimal | number | string
  mouvements: ReadonlyArray<{ nbPieces: number; poidsKg: Prisma.Decimal | number | string | null }>
}

/** Stock restant d'un lot lu en base : règle unique de `cave-fromage.ts`. */
export function stockDuLotFromage(lot: LotAvecSorties): StockLotFromage {
  return stockLotFromage(
    { nbPieces: lot.nbPieces, poidsTotalKg: Number(lot.poidsTotalKg) || 0 },
    lot.mouvements.map((m) => ({ nbPieces: m.nbPieces, poidsKg: Number(m.poidsKg) || 0 })),
  )
}

/**
 * Verrouille un lot de fromage pour la durée de la transaction puis contrôle
 * son reliquat. Le verrou transactionnel PostgreSQL sérialise ventes et sorties
 * manuelles concurrentes visant le même lot.
 */
export async function verrouillerEtVerifierStockFromage(
  tx: Prisma.TransactionClient,
  userId: string,
  lotFromageId: string,
  nbPieces: number,
  poidsKg: number
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:fromage:${lotFromageId}`}))`

  const lot = await tx.lotFromage.findFirst({
    where: { id: lotFromageId, userId },
    include: { mouvements: { select: { nbPieces: true, poidsKg: true } } },
  })
  if (!lot) throw new StockFromageError('Lot de fromage introuvable dans votre cave.', 404)

  const stock = stockDuLotFromage(lot)
  const refus = refusStockFromage(stock, nbPieces, poidsKg)
  if (refus) throw new StockFromageError(refus)

  return { lot, stock }
}

/** Message de refus d'une sortie qui dépasse le stock, null si elle passe. */
export function refusStockFromage(stock: StockLotFromage, nbPieces: number, poidsKg: number): string | null {
  if (nbPieces > stock.restantPieces) {
    return `Stock insuffisant : ${stock.restantPieces} pièce(s) en cave, ${nbPieces} demandée(s).`
  }
  if (poidsKg > stock.restantKg + EPSILON_KG) {
    return `Stock insuffisant : ${stock.restantKg} kg en cave, ${poidsKg} kg demandé(s).`
  }
  return null
}

/**
 * Recale l'état d'un lot après une écriture de sortie, sur la règle de stock
 * unique : une sortie qui épuise le lot le passe « écoulé » ; le retrait d'une
 * sortie (vente annulée, mouvement supprimé) rend « prêt » un lot écoulé qui a
 * de nouveau des pièces en cave.
 */
export async function recalerEtatLotFromage(
  client: Pick<Prisma.TransactionClient, 'lotFromage'>,
  userId: string,
  lotFromageId: string,
  sens: 'sortie' | 'retour',
) {
  const lot = await client.lotFromage.findFirst({
    where: { id: lotFromageId, userId },
    include: { mouvements: { select: { nbPieces: true, poidsKg: true } } },
  })
  if (!lot) return
  const { epuise } = stockDuLotFromage(lot)
  if (sens === 'sortie' && epuise && lot.etat !== 'ecoule') {
    await client.lotFromage.update({ where: { id: lot.id }, data: { etat: 'ecoule' } })
  } else if (sens === 'retour' && !epuise && lot.etat === 'ecoule') {
    await client.lotFromage.update({ where: { id: lot.id }, data: { etat: 'pret' } })
  }
}
