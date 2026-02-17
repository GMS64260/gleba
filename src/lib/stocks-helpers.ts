/**
 * Helpers pour la gestion des stocks (multi-tenancy via UserStock*)
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
 * Calcule le stock net pour une ou plusieurs espèces (per-user)
 * Stock net = Inventaire (à date inventaire) + Σ Récoltes - Σ Consommations
 */
export async function calculerStocksNet(
  userId: string,
  especeId?: string
): Promise<Record<string, StockNet>> {

  // Récupérer les stocks per-user pour les espèces concernées
  const userStocks = await prisma.userStockEspece.findMany({
    where: {
      userId,
      ...(especeId && { especeId }),
    },
    select: {
      especeId: true,
      inventaire: true,
      dateInventaire: true,
    },
  })

  // Si aucun stock per-user, chercher les espèces avec des récoltes/consommations
  const especeIds = userStocks.map(us => us.especeId)
  const additionalEspeces = await prisma.espece.findMany({
    where: {
      ...(especeId && { id: especeId }),
      id: { notIn: especeIds },
      OR: [
        { recoltes: { some: { userId } } },
        { consommations: { some: { userId } } },
      ],
    },
    select: { id: true },
  })

  const allEspeces = [
    ...userStocks.map(us => ({
      id: us.especeId,
      inventaire: us.inventaire,
      dateInventaire: us.dateInventaire,
    })),
    ...additionalEspeces.map(e => ({
      id: e.id,
      inventaire: null as number | null,
      dateInventaire: null as Date | null,
    })),
  ]

  const result: Record<string, StockNet> = {}

  for (const espece of allEspeces) {
    const dateRef = espece.dateInventaire || new Date(0)

    // Récoltes depuis date inventaire
    const recoltes = await prisma.recolte.findMany({
      where: {
        especeId: espece.id,
        userId,
        statut: 'en_stock',
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

/**
 * Calcule le stock d'oeufs disponible pour un utilisateur
 * Stock = Produits - Cassés - Vendus
 */
export async function calculerStockOeufs(userId: string): Promise<{
  stockNet: number
  detail: { produits: number; casses: number; vendus: number }
}> {
  // Total produits et cassés
  const production = await prisma.productionOeuf.aggregate({
    where: { userId },
    _sum: { quantite: true, casses: true },
  })

  const produits = production._sum.quantite || 0
  const casses = production._sum.casses || 0

  // Total vendus (normalisation d'unité : douzaine -> x12)
  const ventes = await prisma.venteProduit.findMany({
    where: { userId, type: 'oeufs' },
    select: { quantite: true, unite: true },
  })

  const vendus = ventes.reduce((sum, v) => {
    const mult = v.unite === 'douzaine' ? 12 : 1
    return sum + v.quantite * mult
  }, 0)

  return {
    stockNet: produits - casses - vendus,
    detail: { produits, casses, vendus },
  }
}
