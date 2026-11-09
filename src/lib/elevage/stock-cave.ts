import prisma from '@/lib/prisma'
import { stockDuLotFromage } from '@/lib/elevage/stock-fromage'
import { valoriserStockFromage } from '@/lib/elevage/cave-fromage'

export interface LotCaveEnStock {
  id: string
  numeroLot: string
  typeFromage: string
  stockPieces: number
  stockKg: number
  /** Estimation au prix constaté des ventes du lot ; `null` sans vente payante. */
  valorisation: number | null
}

/**
 * Lots de fromage encore en cave, pour Comptabilité > Stocks : même stock,
 * même valorisation et même filtre que la vue par défaut d'Élevage > Cave
 * (`/api/elevage/affinage` : lots non écoulés qui gardent des pièces). La cave
 * n'apparaissait dans aucun état de stock de la comptabilité.
 */
export async function chargerCaveEnStock(userId: string): Promise<LotCaveEnStock[]> {
  const lots = await prisma.lotFromage.findMany({
    where: { userId, etat: { not: 'ecoule' } },
    orderBy: { dateFabrication: 'asc' },
    include: {
      mouvements: { select: { nbPieces: true, poidsKg: true } },
      ventesProduit: { where: { annule: false }, select: { quantite: true, unite: true, prixTotal: true } },
    },
  })
  return lots.flatMap((lot) => {
    const stock = stockDuLotFromage(lot)
    if (stock.restantPieces <= 0) return []
    const { valorisation } = valoriserStockFromage(
      { nbPieces: lot.nbPieces, poidsTotalKg: Number(lot.poidsTotalKg) || 0 },
      stock,
      lot.ventesProduit.map((v) => ({ quantite: Number(v.quantite), unite: v.unite, prixTotal: Number(v.prixTotal) })),
    )
    return [{
      id: lot.id,
      numeroLot: lot.numeroLot,
      typeFromage: lot.typeFromage,
      stockPieces: stock.restantPieces,
      stockKg: stock.restantKg,
      valorisation,
    }]
  })
}
