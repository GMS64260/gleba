/**
 * API Route Météo - Prévisions et conditions actuelles
 * GET /api/meteo?parcelleId=X → météo complète pour une parcelle
 * GET /api/meteo?lat=X&lng=Y → météo par coordonnées directes
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getMeteoForParcelle, fetchOpenMeteoForecast, fetchOpenMeteoHistory } from '@/lib/meteo'
import { genererAlertesMeteo, calculerEnsoleillement } from '@/lib/meteo-agro'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const parcelleId = searchParams.get('parcelleId')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    // Mode 1: par parcelle
    if (parcelleId) {
      const meteo = await getMeteoForParcelle(parcelleId, userId)

      if (!meteo) {
        return NextResponse.json(
          { error: 'Parcelle non trouvée ou sans coordonnées GPS' },
          { status: 404 }
        )
      }

      // Enrichir avec les alertes et l'ensoleillement
      const alertes = genererAlertesMeteo(meteo.previsions, meteo.historique7j)
      const ensoleillement = calculerEnsoleillement([...meteo.historique7j, ...meteo.previsions])

      return NextResponse.json({
        ...meteo,
        alertes,
        ensoleillement,
      })
    }

    // Mode 2: par coordonnées directes
    if (lat && lng) {
      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)

      if (isNaN(latNum) || isNaN(lngNum)) {
        return NextResponse.json(
          { error: 'Coordonnées invalides' },
          { status: 400 }
        )
      }

      const { current, daily } = await fetchOpenMeteoForecast(latNum, lngNum)

      // Historique 7 jours
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 8)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      let historique7j: Awaited<ReturnType<typeof fetchOpenMeteoHistory>> = []
      try {
        historique7j = await fetchOpenMeteoHistory(
          latNum, lngNum,
          weekAgo.toISOString().split('T')[0],
          yesterday.toISOString().split('T')[0]
        )
      } catch { /* ignore */ }

      const alertes = genererAlertesMeteo(daily, historique7j)
      const ensoleillement = calculerEnsoleillement([...historique7j, ...daily])

      return NextResponse.json({
        parcelle: { lat: latNum, lng: lngNum },
        actuelle: current,
        previsions: daily,
        historique7j,
        alertes,
        ensoleillement,
        source: 'open-meteo',
      })
    }

    return NextResponse.json(
      { error: 'Paramètre parcelleId ou lat+lng requis' },
      { status: 400 }
    )
  } catch (err) {
    console.error('GET /api/meteo error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données météo' },
      { status: 500 }
    )
  }
}
