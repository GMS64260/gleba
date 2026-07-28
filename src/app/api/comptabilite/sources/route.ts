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

    // Cette vue part directement de la SSOT comptable : chaque VenteManuelle
    // et chaque facture valide apparaît une seule fois. Elle ne réagrège plus
    // les sources brutes, ce qui élimine les doubles comptes des ventes facturées.
    const [ventes, factures] = await Promise.all([
      prisma.venteManuelle.findMany({
        where: { userId, date: { gte: startOfYear, lte: endOfYear } },
        select: { montant: true, module: true, sourceType: true, auto: true },
      }),
      prisma.facture.findMany({
        where: {
          userId,
          date: { gte: startOfYear, lte: endOfYear },
          statut: { notIn: ['annulee', 'brouillon'] },
        },
        select: {
          type: true,
          totalTTC: true,
          ventesProduits: { select: { id: true }, take: 1 },
          abattages: { select: { id: true }, take: 1 },
          recoltesArbres: { select: { id: true }, take: 1 },
          productionsBois: { select: { id: true }, take: 1 },
          commandesBoutique: { select: { id: true }, take: 1 },
        },
      }),
    ])

    const labels: Record<string, string> = {
      vente_produit: 'Ventes produits élevage',
      abattage: 'Ventes viande (abattages)',
      paie_lait: 'Paies du lait',
      reservation_elevage: 'Acomptes et cessions d’animaux',
      commande_boutique: 'Commandes boutique',
      recolte: 'Récoltes potager',
      recolte_arbre: 'Récoltes de fruits',
      production_bois: 'Ventes de bois',
      manuel: 'Saisies manuelles',
      facture: 'Factures',
    }
    const grouped = new Map<string, SourceBreakdown>()
    const add = (module: string, source: string, montant: number) => {
      const key = `${module}:${source}`
      const current = grouped.get(key) ?? {
        module,
        source,
        label: labels[source] ?? source,
        count: 0,
        montant: 0,
      }
      current.count += 1
      current.montant += montant
      grouped.set(key, current)
    }
    for (const vente of ventes) {
      add(vente.module || 'autre', vente.auto ? (vente.sourceType || 'auto') : 'manuel', vente.montant)
    }
    for (const facture of factures) {
      const module = facture.ventesProduits.length || facture.abattages.length
        ? 'elevage'
        : facture.recoltesArbres.length || facture.productionsBois.length
          ? 'verger'
          : facture.commandesBoutique.length
            ? 'boutique'
            : 'autre'
      add(module, 'facture', facture.type === 'avoir' ? -facture.totalTTC : facture.totalTTC)
    }
    const sources = [...grouped.values()].sort((a, b) => b.montant - a.montant)

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
