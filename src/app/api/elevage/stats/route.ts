/**
 * API Stats Élevage - Dashboard (multi-tenancy)
 * GET /api/elevage/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { calculerStockOeufs } from '@/lib/stocks-helpers'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const userId = session.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)
    const startOfPrevYear = new Date(annee - 1, 0, 1)
    const endOfPrevYear = new Date(annee - 1, 11, 31, 23, 59, 59)

    // Stats animaux
    const [
      animauxActifs,
      animauxParType,
      lotsActifs,
      productionOeufsAnnee,
      productionOeufsAnneePrecedente,
      productionOeufsMois,
      ventesAnnee,
      ventesAnneePrecedente,
      ventesParType,
      abattagesAnnee,
      soinsAPlanifier,
      alimentsStockBas,
      stockOeufs,
      mortaliteAnnee,
      totalPondeuses,
      totalConsommationAliments,
    ] = await Promise.all([
      // Animaux actifs
      prisma.animal.count({
        where: { userId, statut: 'actif' },
      }),

      // Animaux par type d'espece
      prisma.animal.groupBy({
        by: ['especeAnimaleId'],
        where: { userId, statut: 'actif' },
        _count: true,
      }),

      // Lots actifs
      prisma.lotAnimaux.count({
        where: { userId, statut: 'actif' },
      }),

      // Production œufs annee
      prisma.productionOeuf.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { quantite: true },
      }),

      // Production œufs annee précédente (N-1)
      prisma.productionOeuf.aggregate({
        where: {
          userId,
          date: { gte: startOfPrevYear, lte: endOfPrevYear },
        },
        _sum: { quantite: true },
      }),

      // Production œufs par mois
      prisma.$queryRaw`
        SELECT
          EXTRACT(MONTH FROM date) as mois,
          SUM(quantite) as total
        FROM production_oeufs
        WHERE user_id = ${userId}
          AND date >= ${startOfYear}
          AND date <= ${endOfYear}
        GROUP BY EXTRACT(MONTH FROM date)
        ORDER BY mois
      ` as Promise<{ mois: number; total: bigint }[]>,

      // Ventes annee (montant total)
      prisma.venteProduit.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { prixTotal: true },
        _count: true,
      }),

      // Ventes annee précédente (N-1)
      prisma.venteProduit.aggregate({
        where: {
          userId,
          date: { gte: startOfPrevYear, lte: endOfPrevYear },
        },
        _sum: { prixTotal: true },
        _count: true,
      }),

      // Ventes par type
      prisma.venteProduit.groupBy({
        by: ['type'],
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { prixTotal: true },
        _count: true,
      }),

      // Abattages annee
      prisma.abattage.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { quantite: true, poidsCarcasse: true },
        _count: true,
      }),

      // Soins à planifier (non faits)
      prisma.soinAnimal.count({
        where: {
          userId,
          fait: false,
          datePrevue: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 jours
        },
      }),

      // Aliments en stock bas (via UserStockAliment per-user)
      prisma.userStockAliment.count({
        where: {
          userId,
          stock: { not: null },
          stockMin: { not: null },
          AND: [
            { stock: { gt: 0 } },
          ],
        },
      }).then(async () => {
        // Count those where stock <= stockMin
        const lowStock = await prisma.userStockAliment.findMany({
          where: {
            userId,
            stock: { not: null },
            stockMin: { not: null },
          },
          select: { stock: true, stockMin: true },
        })
        return lowStock.filter(a => a.stock !== null && a.stockMin !== null && a.stock <= a.stockMin).length
      }),

      // Stock oeufs calculé
      calculerStockOeufs(userId),

      // Mortalité annee (animaux morts cette annee)
      prisma.animal.count({
        where: {
          userId,
          statut: 'mort',
          dateSortie: { gte: startOfYear, lte: endOfYear },
        },
      }),

      // Total pondeuses actives (lots volaille actifs, somme quantiteActuelle)
      prisma.lotAnimaux.aggregate({
        where: {
          userId,
          statut: 'actif',
          especeAnimale: { production: { in: ['oeufs', 'mixte'] } },
        },
        _sum: { quantiteActuelle: true },
      }),

      // Total consommation aliments annee (kg)
      prisma.consommationAliment.aggregate({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { quantite: true },
      }),
    ])

    // Récupérer les noms des especes pour les stats
    const especeIds = animauxParType.map(a => a.especeAnimaleId)
    const especes = await prisma.especeAnimale.findMany({
      where: { id: { in: especeIds } },
      select: { id: true, nom: true, couleur: true },
    })

    const especeMap = new Map(especes.map(e => [e.id, e]))

    // Métriques calculées
    const nbPondeuses = totalPondeuses._sum.quantiteActuelle || 0
    const nbOeufsAnnee = productionOeufsAnnee._sum.quantite || 0
    const nbOeufsAnneePrecedente = productionOeufsAnneePrecedente._sum.quantite || 0
    const ventesTotal = ventesAnnee._sum.prixTotal || 0
    const ventesTotalPrecedente = ventesAnneePrecedente._sum.prixTotal || 0
    const consoAlimentsKg = totalConsommationAliments._sum.quantite || 0
    const poidsCarcasseTotal = abattagesAnnee._sum.poidsCarcasse || 0

    // Jours écoulés dans l'annee (pour taux de ponte pro-rata)
    const now = new Date()
    const joursEcoules = annee === now.getFullYear()
      ? Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24))
      : 365

    // Taux de ponte (%) = oeufs / (pondeuses * jours) * 100
    const tauxPonte = nbPondeuses > 0 && joursEcoules > 0
      ? (nbOeufsAnnee / (nbPondeuses * joursEcoules)) * 100
      : null

    // FCR = kg aliment / kg carcasse
    const fcr = poidsCarcasseTotal > 0 ? consoAlimentsKg / poidsCarcasseTotal : null

    // Taux de mortalité
    const totalAnimauxEver = animauxActifs + mortaliteAnnee
    const tauxMortalite = totalAnimauxEver > 0
      ? (mortaliteAnnee / totalAnimauxEver) * 100
      : 0

    return NextResponse.json({
      stats: {
        animauxActifs,
        lotsActifs,
        productionOeufsAnnee: nbOeufsAnnee,
        productionOeufsAnneePrecedente: nbOeufsAnneePrecedente,
        ventesAnnee: ventesTotal,
        ventesAnneePrecedente: ventesTotalPrecedente,
        nbVentes: ventesAnnee._count,
        abattagesAnnee: abattagesAnnee._sum.quantite || 0,
        poidsCarcasseAnnee: poidsCarcasseTotal,
        soinsAPlanifier,
        alimentsStockBas,
        stockOeufs: stockOeufs.stockNet,
        stockOeufsDetail: stockOeufs.detail,
        // Nouvelles métriques
        mortaliteAnnee,
        tauxMortalite: Math.round(tauxMortalite * 10) / 10,
        tauxPonte: tauxPonte !== null ? Math.round(tauxPonte * 10) / 10 : null,
        nbPondeuses,
        fcr: fcr !== null ? Math.round(fcr * 100) / 100 : null,
        consoAlimentsKg: Math.round(consoAlimentsKg * 10) / 10,
      },
      animauxParType: animauxParType.map(a => ({
        especeAnimaleId: a.especeAnimaleId,
        nom: especeMap.get(a.especeAnimaleId)?.nom || a.especeAnimaleId,
        couleur: especeMap.get(a.especeAnimaleId)?.couleur,
        count: a._count,
      })),
      ventesParType: ventesParType.map(v => ({
        type: v.type,
        total: v._sum.prixTotal || 0,
        count: v._count,
      })),
      productionOeufsMois: productionOeufsMois.map(p => ({
        mois: Number(p.mois),
        total: Number(p.total),
      })),
    })
  } catch (error) {
    console.error('GET /api/elevage/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stats', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
