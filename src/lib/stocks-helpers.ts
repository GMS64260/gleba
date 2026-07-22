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
 * Calcule le stock net pour une ou plusieurs especes (per-user)
 * Stock net = Inventaire (à date inventaire) + Σ Récoltes - Σ Consommations
 */
export async function calculerStocksNet(
  userId: string,
  especeId?: string
): Promise<Record<string, StockNet>> {

  // Récupérer les stocks per-user pour les especes concernées
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

  // Si aucun stock per-user, chercher les especes avec des recoltes/consommations
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

  // Audit 2026-07 (#51) : une récolte « mise en vente » dans la boutique (liée
  // à un ProduitBoutique actif) est committée à la boutique — son stock est
  // suivi par ProduitBoutique.stockDispo. On l'EXCLUT du stock physique loose
  // pour ne pas la compter deux fois (avant, elle restait « en stock » même
  // après avoir été vendue en ligne).
  const produitsBoutique = await prisma.produitBoutique.findMany({
    where: { userId, actif: true, recolteId: { not: null } },
    select: { recolteId: true },
  })
  const recolteIdsEnBoutique = produitsBoutique
    .map(p => p.recolteId)
    .filter((id): id is number => id != null)

  const result: Record<string, StockNet> = {}

  for (const espece of allEspeces) {
    // Modèle « baseline + événements » (refonte stock 2026-07).
    // `inventaire`/`dateInventaire` = POINT DE COMPTAGE MANUEL (null si jamais
    // fait). Le stock net est recalculé ici comme UNIQUE source de vérité :
    //   net = baseline + Σ récoltes en stock APRÈS le comptage − Σ conso APRÈS.
    // Les événements AVANT le comptage sont déjà reflétés dans la valeur saisie.
    // Sans comptage manuel : baseline 0 depuis l'epoch → on somme tout.
    // (Avant, l'inventaire était AUSSI incrémenté à chaque récolte puis les
    // récoltes ré-additionnées ici → double comptage, audit #28.)
    const dateRef = espece.dateInventaire || new Date(0)
    const baseline = espece.inventaire || 0

    // Récoltes encore en stock, postérieures au comptage, HORS boutique
    const recoltes = await prisma.recolte.findMany({
      where: {
        especeId: espece.id,
        userId,
        statut: 'en_stock',
        date: { gt: dateRef },
        ...(recolteIdsEnBoutique.length > 0 && { id: { notIn: recolteIdsEnBoutique } }),
      },
      select: { quantite: true },
    })
    const totalRecoltes = recoltes.reduce((sum, r) => sum + r.quantite, 0)

    // Consommations postérieures au comptage
    const consommations = await prisma.consommation.findMany({
      where: {
        especeId: espece.id,
        userId,
        date: { gt: dateRef },
      },
      select: { quantite: true },
    })
    const totalConso = consommations.reduce((sum, c) => sum + c.quantite, 0)

    result[espece.id] = {
      stockNet: baseline + totalRecoltes - totalConso,
      detail: {
        inventaire: baseline,
        recoltes: totalRecoltes,
        consommations: totalConso,
      },
    }
  }

  return result
}

/**
 * Calcule le stock d'oeufs disponible pour un utilisateur
 * Stock = Produits - Cassés - Souillés - Vendus
 *
 * Bug cmp8rw40u (Marc 2026-05-16) — les œufs souillés étaient saisis
 * mais jamais sortis du stock, donc "stock œufs == production" même
 * quand l'éleveur déclarait des sales. On les soustrait désormais comme
 * les cassés (ils ne sont pas vendables).
 */
export async function calculerStockOeufs(userId: string): Promise<{
  stockNet: number
  detail: { produits: number; casses: number; sales: number; vendus: number }
}> {
  const production = await prisma.productionOeuf.aggregate({
    where: { userId },
    _sum: { quantite: true, casses: true, sales: true },
  })

  const produits = production._sum.quantite || 0
  const casses = production._sum.casses || 0
  const sales = production._sum.sales || 0

  // Total vendus (normalisation d'unité : douzaine -> x12)
  const ventes = await prisma.venteProduit.findMany({
    // Revue élevage 2026-07-21 — exclure les ventes annulées (soft-delete),
    // sinon leurs œufs restent déduits du stock à perpétuité.
    where: { userId, type: 'oeufs', annule: false },
    select: { quantite: true, unite: true },
  })

  const vendus = ventes.reduce((sum, v) => {
    const mult = v.unite === 'douzaine' ? 12 : 1
    return sum + v.quantite * mult
  }, 0)

  return {
    stockNet: produits - casses - sales - vendus,
    detail: { produits, casses, sales, vendus },
  }
}
