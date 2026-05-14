/**
 * API Route Météo - Historique
 * GET /api/meteo/history?parcelleId=X&start=YYYY-MM-DD&end=YYYY-MM-DD
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getMeteoHistorique } from '@/lib/meteo'
import { calculerBilanHydrique, calculerDegreJours, calculerEnsoleillement } from '@/lib/meteo-agro'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const parcelleId = searchParams.get('parcelleId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!parcelleId || !start || !end) {
      return NextResponse.json(
        { error: 'Paramètres parcelleId, start et end requis' },
        { status: 400 }
      )
    }

    // Validation des dates
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide (YYYY-MM-DD attendu)' },
        { status: 400 }
      )
    }

    // Limiter à 1 an max
    const diffDays = (endDate.getTime() - startDate.getTime()) / 86400000
    if (diffDays > 365) {
      return NextResponse.json(
        { error: 'Période limitée à 365 jours maximum' },
        { status: 400 }
      )
    }

    const historique = await getMeteoHistorique(parcelleId, userId, start, end)

    if (!historique) {
      return NextResponse.json(
        { error: 'Parcelle non trouvée ou sans coordonnées GPS' },
        { status: 404 }
      )
    }

    // Calculs agronomiques
    const bilanHydrique = calculerBilanHydrique(historique.donnees)
    const degreJours = calculerDegreJours(historique.donnees)
    const ensoleillement = calculerEnsoleillement(historique.donnees)

    return NextResponse.json({
      ...historique,
      bilanHydrique,
      degreJours,
      ensoleillement,
    })
  } catch (err) {
    console.error('GET /api/meteo/history error:', err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'historique météo" },
      { status: 500 }
    )
  }
}
