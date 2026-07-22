import type { Prisma } from '@prisma/client'

export class StockFromageError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message)
    this.name = 'StockFromageError'
  }
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

  const sortiPieces = lot.mouvements.reduce((s, m) => s + m.nbPieces, 0)
  const sortiKg = lot.mouvements.reduce((s, m) => s + (Number(m.poidsKg) || 0), 0)
  const restantPieces = lot.nbPieces - sortiPieces
  const restantKg = Number(lot.poidsTotalKg) - sortiKg

  if (nbPieces > restantPieces) {
    throw new StockFromageError(
      `Stock insuffisant : ${Math.max(0, restantPieces)} pièce(s) en cave, ${nbPieces} demandée(s).`
    )
  }
  if (poidsKg > restantKg + 1e-6) {
    throw new StockFromageError(
      `Stock insuffisant : ${Math.max(0, Math.round(restantKg * 1000) / 1000)} kg en cave, ${poidsKg} demandé(s).`
    )
  }

  return { lot, sortiPieces, sortiKg }
}
