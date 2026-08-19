/**
 * API Coûts de Production
 * GET /api/comptabilite/couts-production
 * Agrège TOUTES les données des modules pour calculer la rentabilité.
 * Le calcul vit dans src/lib/comptabilite/couts-production.ts (SSOT partagée
 * avec l'outil assistant `get_marges_ateliers`) — lot assistant 2026-08-11.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { computeCoutsProduction } from '@/lib/comptabilite/couts-production'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const module = searchParams.get('module') || 'all'

    const couts = await computeCoutsProduction(session.user.id, year)

    return NextResponse.json({
      ...couts,
      meta: {
        annee: year,
        module,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/couts-production error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du calcul des couts de production', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
