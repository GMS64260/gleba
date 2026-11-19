import prisma from '@/lib/prisma'
import { stockDuLotFromage } from '@/lib/elevage/stock-fromage'
import { valoriserVentesFromage } from '@/lib/elevage/economie-lait-ventes'
import { chargerVentesFromage } from '@/lib/elevage/ventes-fromage'

export interface LotCaveEnStock {
  id: string
  numeroLot: string
  typeFromage: string
  stockPieces: number
  stockKg: number
  /** Estimation au prix constaté des ventes du lot ; `null` sans vente payante. */
  valorisation: number | null
  avertissementValorisation: string | null
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
      mouvements: { where: { userId }, select: { nbPieces: true, poidsKg: true } },
    },
  })
  if (lots.length === 0) return []
  const ventes = await chargerVentesFromage(userId, undefined, { lotIds: lots.filter(l => stockDuLotFromage(l).restantPieces > 0).map(l => l.id), valorisation: true })
  return lots.flatMap((lot) => {
    const stock = stockDuLotFromage(lot)
    if (stock.restantPieces <= 0) return []
    const { valorisation, avertissementValorisation } = valoriserVentesFromage(
      { nbPieces: lot.nbPieces, poidsTotalKg: Number(lot.poidsTotalKg) || 0 },
      stock,
      ventes.filter(v => v.lotFromageId === lot.id),
    )
    return [{
      id: lot.id,
      numeroLot: lot.numeroLot,
      typeFromage: lot.typeFromage,
      stockPieces: stock.restantPieces,
      stockKg: stock.restantKg,
      valorisation,
      avertissementValorisation,
    }]
  })
}
