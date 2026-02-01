/**
 * Helpers pour la gestion des stocks
 * Calcul du stock net = Inventaire + Récoltes - Consommations
 */

import prisma from '@/lib/prisma'

export interface StockNet {
  stockNet: number
  detail: {
    inventaire: number
    recoltes: number
    consommations: number
  }
}

/**
 * Calcule le stock net pour une ou plusieurs espèces
 * Stock net = Inventaire (à date inventaire) + Σ Récoltes - Σ Consommations
 */
export async function calculerStocksNet(
  userId: string,
  especeId?: string
): Promise<Record<string, StockNet>> {

  // Récupérer les espèces concernées
  const especes = await prisma.espece.findMany({
    where: {
      ...(especeId && { id: especeId }),
      OR: [
        { cultures: { some: { userId } } },
        { recoltes: { some: { userId } } },
        { consommations: { some: { userId } } },
      ]
    },
    select: {
      id: true,
      inventaire: true,
      dateInventaire: true,
    },
  })

  const result: Record<string, StockNet> = {}

  for (const espece of especes) {
    const dateRef = espece.dateInventaire || new Date(0)

    // Récoltes depuis date inventaire
    const recoltes = await prisma.recolte.findMany({
      where: {
        especeId: espece.id,
        userId,
        date: { gte: dateRef },
      },
      select: { quantite: true },
    })
    const totalRecoltes = recoltes.reduce((sum, r) => sum + r.quantite, 0)

    // Consommations depuis date inventaire
    const consommations = await prisma.consommation.findMany({
      where: {
        especeId: espece.id,
        userId,
        date: { gte: dateRef },
      },
      select: { quantite: true },
    })
    const totalConso = consommations.reduce((sum, c) => sum + c.quantite, 0)

    result[espece.id] = {
      stockNet: (espece.inventaire || 0) + totalRecoltes - totalConso,
      detail: {
        inventaire: espece.inventaire || 0,
        recoltes: totalRecoltes,
        consommations: totalConso,
      },
    }
  }

  return result
}
