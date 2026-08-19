/**
 * API Stocks unifiés (multi-tenancy via UserStock*)
 * GET /api/comptabilite/stocks
 * Vue consolidée de tous les stocks de tous les modules.
 * Le calcul vit dans src/lib/comptabilite/stocks-unifies.ts (SSOT partagée
 * avec l'outil assistant `get_stocks_valorises`) — lot assistant 2026-08-11.
 */

import { NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { computeStocksUnifies } from '@/lib/comptabilite/stocks-unifies'

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const stocks = await computeStocksUnifies(session.user.id)
    return NextResponse.json(stocks)
  } catch (error) {
    console.error('GET /api/comptabilite/stocks error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
