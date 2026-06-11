/**
 * API Analyse des Couts Elevage - Par lot
 * GET /api/elevage/analyse-couts?annee=2026
 * Calcule : cout achat + soins + alimentation vs revenus (ventes + abattages)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const userId = session.user.id
    const startOfYear = new Date(annee, 0, 1)
    const endOfYear = new Date(annee, 11, 31, 23, 59, 59)

    // Lots actifs avec espece
    const lots = await prisma.lotAnimaux.findMany({
      where: { userId },
      include: {
        especeAnimale: { select: { id: true, nom: true } },
      },
    })

    const analyses = await Promise.all(lots.map(async (lot) => {
      // Couts soins du lot
      const coutsSoins = await prisma.soinAnimal.aggregate({
        where: {
          userId,
          lotId: lot.id,
          fait: true,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { cout: true },
        _count: true,
      })

      // Cout alimentation du lot
      const consoAliments = await prisma.consommationAliment.findMany({
        where: {
          userId,
          lotId: lot.id,
          date: { gte: startOfYear, lte: endOfYear },
        },
        include: {
          aliment: { select: { prix: true, nom: true } },
        },
      })
      const coutAlimentation = consoAliments.reduce((sum, c) => {
        const prixKg = c.aliment.prix || 0
        return sum + c.quantite * prixKg
      }, 0)
      const totalConsoKg = consoAliments.reduce((sum, c) => sum + c.quantite, 0)

      // Revenus abattages du lot (les ventes de produits ne sont pas
      // rattachables à un lot dans le schéma — seuls les abattages le sont).
      // Exclure les abattages annulés, sinon un abattage annulé continue de
      // gonfler la marge du lot.
      const revenusAbattages = await prisma.abattage.aggregate({
        where: {
          userId,
          lotId: lot.id,
          annule: false,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { prixVente: true, poidsCarcasse: true, quantite: true },
      })

      // Production œufs du lot
      const productionOeufs = await prisma.productionOeuf.aggregate({
        where: {
          userId,
          lotId: lot.id,
          date: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { quantite: true },
      })

      const coutAchat = lot.prixAchatTotal || 0
      const coutSoinsTotal = coutsSoins._sum.cout || 0
      const coutTotal = coutAchat + coutSoinsTotal + coutAlimentation
      const revenusVentes = revenusAbattages._sum.prixVente || 0
      const marge = revenusVentes - coutTotal
      const coutParAnimal = lot.quantiteActuelle > 0 ? coutTotal / lot.quantiteActuelle : 0
      const totalOeufs = productionOeufs._sum.quantite || 0
      const coutParOeuf = totalOeufs > 0 ? coutTotal / totalOeufs : null

      return {
        lotId: lot.id,
        lotNom: lot.nom || `Lot #${lot.id}`,
        espece: lot.especeAnimale.nom,
        quantiteActuelle: lot.quantiteActuelle,
        quantiteInitiale: lot.quantiteInitiale,
        statut: lot.statut,
        couts: {
          achat: Math.round(coutAchat * 100) / 100,
          soins: Math.round(coutSoinsTotal * 100) / 100,
          alimentation: Math.round(coutAlimentation * 100) / 100,
          total: Math.round(coutTotal * 100) / 100,
        },
        revenus: {
          ventes: Math.round(revenusVentes * 100) / 100,
        },
        marge: Math.round(marge * 100) / 100,
        metriques: {
          coutParAnimal: Math.round(coutParAnimal * 100) / 100,
          coutParOeuf: coutParOeuf !== null ? Math.round(coutParOeuf * 100) / 100 : null,
          totalOeufs,
          totalConsoKg: Math.round(totalConsoKg * 10) / 10,
          poidsCarcasse: revenusAbattages._sum.poidsCarcasse || 0,
          nbAbattages: revenusAbattages._sum.quantite || 0,
          nbSoins: coutsSoins._count,
        },
      }
    }))

    // Stats globales
    const totalCouts = analyses.reduce((s, a) => s + a.couts.total, 0)
    const totalRevenus = analyses.reduce((s, a) => s + a.revenus.ventes, 0)

    return NextResponse.json({
      data: analyses.filter(a => a.couts.total > 0 || a.revenus.ventes > 0 || a.metriques.totalOeufs > 0),
      stats: {
        totalCouts: Math.round(totalCouts * 100) / 100,
        totalRevenus: Math.round(totalRevenus * 100) / 100,
        margeGlobale: Math.round((totalRevenus - totalCouts) * 100) / 100,
        nbLots: lots.length,
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/analyse-couts error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du calcul des couts', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
