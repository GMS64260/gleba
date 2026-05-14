/**
 * API Sources de revenus - Réconciliation
 * GET /api/comptabilite/sources
 *
 * Retourne le breakdown détaillé des revenus par source (table source en base),
 * pour permettre à l'utilisateur de comprendre exactement ce qui contribue à son
 * chiffre d'affaires affiché en comptabilité.
 *
 * NB : ce endpoint est strictement en lecture. La logique de calcul reste celle
 * de /api/comptabilite/revenus (mêmes filtres, mêmes exclusions).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

interface SourceBreakdown {
  module: string
  source: string
  label: string
  count: number
  montant: number
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear()

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    const [
      ventesElevage,
      recoltesArbres,
      venteBois,
      venteAbattage,
      recoltesPotager,
      ventesManuelles,
      commandesBoutique,
    ] = await Promise.all([
      prisma.venteProduit.findMany({
        where: {
          userId,
          annule: { not: true },
          date: { gte: startOfYear, lte: endOfYear },
        },
        select: { prixTotal: true },
      }),
      prisma.recolteArbre.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startOfYear, lte: endOfYear },
          prixKg: { not: null },
        },
        select: { quantite: true, prixKg: true },
      }),
      prisma.productionBois.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          destination: 'vente',
          prixVente: { not: null },
        },
        select: { prixVente: true },
      }),
      prisma.abattage.findMany({
        where: {
          userId,
          annule: { not: true },
          date: { gte: startOfYear, lte: endOfYear },
          destination: 'vente',
          prixVente: { not: null },
        },
        select: { prixVente: true },
      }),
      prisma.recolte.findMany({
        where: {
          userId,
          statut: 'vendu',
          dateVente: { gte: startOfYear, lte: endOfYear },
          prixTotal: { not: null },
        },
        select: { prixTotal: true, quantite: true, prixKg: true },
      }),
      prisma.venteManuelle.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          auto: { not: true },
        },
        select: { montant: true },
      }),
      prisma.commandeBoutique.findMany({
        where: {
          userId,
          statut: 'livree',
          createdAt: { gte: startOfYear, lte: endOfYear },
        },
        select: { total: true },
      }),
    ])

    const sources: SourceBreakdown[] = [
      {
        module: 'potager',
        source: 'Recolte',
        label: 'Récoltes potager vendues',
        count: recoltesPotager.length,
        montant: recoltesPotager.reduce(
          (s, r) => s + (r.prixTotal || (r.quantite * (r.prixKg || 0))),
          0,
        ),
      },
      {
        module: 'verger',
        source: 'RecolteArbre',
        label: 'Récoltes de fruits vendues',
        count: recoltesArbres.length,
        montant: recoltesArbres.reduce(
          (s, r) => s + r.quantite * (r.prixKg || 0),
          0,
        ),
      },
      {
        module: 'verger',
        source: 'ProductionBois',
        label: 'Ventes de bois',
        count: venteBois.length,
        montant: venteBois.reduce((s, b) => s + (b.prixVente || 0), 0),
      },
      {
        module: 'elevage',
        source: 'VenteProduit',
        label: 'Ventes produits élevage (œufs, lait, etc.)',
        count: ventesElevage.length,
        montant: ventesElevage.reduce((s, v) => s + v.prixTotal, 0),
      },
      {
        module: 'elevage',
        source: 'Abattage',
        label: 'Ventes viande (abattages)',
        count: venteAbattage.length,
        montant: venteAbattage.reduce((s, a) => s + (a.prixVente || 0), 0),
      },
      {
        module: 'boutique',
        source: 'CommandeBoutique',
        label: 'Commandes boutique livrées',
        count: commandesBoutique.length,
        montant: commandesBoutique.reduce((s, c) => s + c.total, 0),
      },
      {
        module: 'autre',
        source: 'VenteManuelle',
        label: 'Saisies manuelles (hors auto)',
        count: ventesManuelles.length,
        montant: ventesManuelles.reduce((s, v) => s + v.montant, 0),
      },
    ]

    const total = sources.reduce((s, x) => s + x.montant, 0)

    return NextResponse.json({
      year,
      sources,
      total,
    })
  } catch (err) {
    console.error('GET /api/comptabilite/sources error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: 'Erreur interne du serveur' },
      { status: 500 },
    )
  }
}
