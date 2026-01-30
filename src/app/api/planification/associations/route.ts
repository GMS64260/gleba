/**
 * API Route pour les associations de cultures
 * GET /api/planification/associations
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getAssociations } from '@/lib/planification'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const associations = await getAssociations(userId, annee)

    // Filtrer les associations qui ont des voisins
    const avecVoisins = associations.filter(a => a.planchesVoisines.length > 0)

    return NextResponse.json({
      data: associations,
      stats: {
        totalPlanches: associations.length,
        planchesAvecVoisins: avecVoisins.length,
      },
      annee,
    })
  } catch (error) {
    console.error('GET /api/planification/associations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des associations', details: String(error) },
      { status: 500 }
    )
  }
}
