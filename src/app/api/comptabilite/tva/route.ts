/**
 * API TVA - Résumé pour déclaration
 * GET /api/comptabilite/tva
 *
 * Audit comptable BUG #8 — la logique a été extraite dans
 * `src/lib/kpi/tva.ts` (`computeTvaPeriode`) pour que le Bilan
 * (`/api/comptabilite/bilan`) utilise EXACTEMENT la même formule
 * et le même arrondi global par taux. Plus d'écart de 0,91 €.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { computeTvaPeriode } from '@/lib/kpi/tva'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const trimestre = searchParams.get('trimestre')

    const userId = session.user.id

    let startDate: Date
    let endDate: Date
    if (trimestre) {
      const t = parseInt(trimestre)
      startDate = new Date(year, (t - 1) * 3, 1)
      endDate = new Date(year, t * 3, 0, 23, 59, 59)
    } else {
      startDate = new Date(year, 0, 1)
      endDate = new Date(year, 11, 31, 23, 59, 59)
    }

    const tva = await computeTvaPeriode(userId, startDate, endDate)

    return NextResponse.json({
      periode: {
        annee: year,
        trimestre: trimestre ? parseInt(trimestre) : null,
        debut: startDate.toISOString(),
        fin: endDate.toISOString(),
      },
      collectee: tva.collectee,
      deductible: tva.deductible,
      solde: tva.solde,
      details: tva.details,
    })
  } catch (error) {
    console.error('GET /api/comptabilite/tva error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
