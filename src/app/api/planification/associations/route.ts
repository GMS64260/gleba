/**
 * API Route pour les associations de cultures
 * GET /api/planification/associations
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getAssociations } from '@/lib/planification'
import { lireAnnee } from '@/lib/api/annee'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    // `?annee=abc` donnait NaN, puis une erreur Prisma et un 500 : repli sur
    // l'année courante, comme les autres listes de la planification.
    const { annee } = lireAnnee(searchParams)

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
      { error: 'Erreur lors de la récupération des associations', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
