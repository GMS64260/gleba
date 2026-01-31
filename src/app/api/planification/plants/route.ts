/**
 * API Route pour les besoins en plants
 * GET /api/planification/plants
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getBesoinsPlants } from '@/lib/planification'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const besoins = await getBesoinsPlants(userId, annee)

    // Calculer les totaux
    const totalPlants = besoins.reduce((sum, b) => sum + b.nbPlants, 0)
    const totalCultures = besoins.reduce((sum, b) => sum + b.cultures.length, 0)
    const totalACommander = besoins.reduce((sum, b) => sum + b.aCommander, 0)
    const besoinsSansStock = besoins.filter(b => b.aCommander > 0)

    // Grouper par semaine de plantation
    const parSemaine: Record<number, number> = {}
    for (const besoin of besoins) {
      if (besoin.semainePlantation) {
        parSemaine[besoin.semainePlantation] = (parSemaine[besoin.semainePlantation] || 0) + besoin.nbPlants
      }
    }

    return NextResponse.json({
      data: besoins,
      stats: {
        nbEspeces: besoins.length,
        totalPlants,
        totalCultures,
        totalACommander,
        especesSansStock: besoinsSansStock.length,
        parSemaine,
      },
      annee,
    })
  } catch (error) {
    console.error('GET /api/planification/plants error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des besoins en plants', details: String(error) },
      { status: 500 }
    )
  }
}
