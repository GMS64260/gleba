/**
 * Lecture des produits de la ruche (récoltes, totaux annuels, stocks FIFO) —
 * source unique de vérité de l'écran Élevage > Production > Produits de la ruche.
 *
 * Extrait de GET /api/elevage/production-ruche (lot assistant 2026-08-11) pour
 * être partagé avec l'outil assistant `get_productions_ruche` : les quantités
 * récoltées et disponibles citées par l'assistant sont celles de l'écran.
 */

import prisma from '@/lib/prisma'
import { calculerStocksRuche } from '@/lib/elevage/stock-ruche'

function periodeAnnee(annee: number) {
  return {
    gte: new Date(annee, 0, 1),
    lte: new Date(annee, 11, 31, 23, 59, 59, 999),
  }
}

export type ProductionsRucheLecture = Awaited<ReturnType<typeof computeProductionsRuche>>

export async function computeProductionsRuche(
  userId: string,
  annee: number,
  limit = 200,
) {
  const where = {
    userId,
    date: periodeAnnee(annee),
  }

  const [productions, totaux, productionsStock] = await Promise.all([
    prisma.productionRuche.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: limit,
      include: {
        mouvementsStock: { select: { quantite: true } },
        lot: {
          select: {
            id: true,
            nom: true,
            especeAnimale: { select: { nom: true } },
          },
        },
        animal: {
          select: {
            id: true,
            nom: true,
            identifiant: true,
            especeAnimale: { select: { nom: true } },
          },
        },
      },
    }),
    prisma.productionRuche.groupBy({
      by: ["produit", "unite"],
      where,
      _sum: { quantite: true },
      _count: true,
      orderBy: [{ produit: "asc" }, { unite: "asc" }],
    }),
    prisma.productionRuche.findMany({
      where: { userId },
      select: {
        produit: true,
        unite: true,
        quantite: true,
        mouvementsStock: { select: { quantite: true } },
      },
    }),
  ])

  return {
    data: productions.map((production) => {
      const sorti = production.mouvementsStock.reduce(
        (somme, mouvement) => somme + mouvement.quantite,
        0,
      )
      return {
        ...production,
        quantiteDisponible: Math.max(0, production.quantite - sorti),
      }
    }),
    stats: totaux.map((total) => ({
      produit: total.produit,
      unite: total.unite,
      quantite: total._sum.quantite ?? 0,
      nbRecoltes: total._count,
    })),
    stocks: calculerStocksRuche(productionsStock),
    meta: { annee, total: productions.length },
  }
}
