/**
 * API Route pour les besoins en semences
 * GET /api/planification/semences
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getBesoinsSemences } from '@/lib/planification'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const besoins = await getBesoinsSemences(userId, annee)

    // Calculer les totaux
    const totalPlants = besoins.reduce((sum, b) => sum + b.nbPlants, 0)
    const totalGraines = besoins.reduce((sum, b) => sum + b.grainesNecessaires, 0)
    const totalACommander = besoins.reduce((sum, b) => sum + b.aCommander, 0)
    const besoinsSansStock = besoins.filter(b => b.aCommander > 0)

    return NextResponse.json({
      data: besoins,
      stats: {
        nbEspeces: besoins.length,
        totalPlants,
        totalGraines,
        totalACommander,
        especesSansStock: besoinsSansStock.length,
      },
      annee,
    })
  } catch (error) {
    console.error('GET /api/planification/semences error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des besoins en semences', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
