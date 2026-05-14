import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { fetchNappeInfo } from '@/lib/hubeau'

/**
 * GET /api/meteo/nappe?lat=X&lng=Y
 * Retourne les informations de la nappe phréatique la plus proche
 * Source : Hub'Eau (Eaufrance) — API Piézométrie
 */
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const latStr = searchParams.get('lat')
    const lngStr = searchParams.get('lng')

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { error: 'Paramètres lat et lng requis' },
        { status: 400 }
      )
    }

    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Coordonnées invalides' },
        { status: 400 }
      )
    }

    const nappeInfo = await fetchNappeInfo(lat, lng)

    if (!nappeInfo) {
      return NextResponse.json(
        { error: 'Aucune station piézométrique trouvée dans un rayon de 50 km' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      source: "Hub'Eau (Eaufrance)",
      station: {
        code: nappeInfo.station.code_bss,
        commune: nappeInfo.station.nom_commune,
        departement: nappeInfo.station.nom_departement,
        distance_km: nappeInfo.station.distance_km,
        altitude: nappeInfo.station.altitude_station,
      },
      nappe: {
        niveauActuel: nappeInfo.niveauActuel,
        profondeurActuelle: nappeInfo.profondeurActuelle,
        tendance: nappeInfo.tendance,
        variationMensuelle: nappeInfo.variationMensuelle,
        dateReleve: nappeInfo.dateReleve,
      },
      historique: nappeInfo.mesures.map(m => ({
        date: m.date_mesure,
        niveau: m.niveau_nappe_eau,
        profondeur: m.profondeur_nappe,
      })),
    })
  } catch (err) {
    console.error('GET /api/meteo/nappe error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données nappe' },
      { status: 500 }
    )
  }
}
