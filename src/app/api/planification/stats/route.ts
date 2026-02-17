/**
 * API Route pour les statistiques de planification
 * GET /api/planification/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getStatsPlanification } from '@/lib/planification'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const stats = await getStatsPlanification(userId, annee)

    return NextResponse.json({
      ...stats,
      annee,
    })
  } catch (error) {
    console.error('GET /api/planification/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des statistiques', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
