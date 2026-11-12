import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { fetchNappeInfo, RAYON_RECHERCHE_NAPPE_KM } from '@/lib/hubeau'

/**
 * Panne de Hub'Eau (délai, réseau, HTTP en erreur) : l'écran la traite comme
 * une indisponibilité passagère. Reconnue par son nom : l'erreur peut venir du
 * recul du cache, qui la rejoue telle quelle.
 */
function estPanneAmont(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.name === 'TimeoutError' || err.name === 'AbortError' || err.name === 'HubEauIndisponibleError'
}

/**
 * GET /api/meteo/nappe?lat=X&lng=Y
 * Retourne les informations de la nappe phréatique la plus proche
 * Source : Hub'Eau (Eaufrance) — API Piézométrie
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
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

    // `Number`, pas `parseFloat` : « 43.6abc » n'est pas une coordonnée.
    const lat = Number(latStr)
    const lng = Number(lngStr)

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Coordonnées invalides' },
        { status: 400 }
      )
    }

    const nappeInfo = await fetchNappeInfo(lat, lng)

    if (!nappeInfo) {
      return NextResponse.json(
        { error: `Aucune station piézométrique en service dans un rayon de ${RAYON_RECHERCHE_NAPPE_KM} km` },
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
    if (estPanneAmont(err)) {
      console.warn('GET /api/meteo/nappe HubEau indisponible:', err)
      return NextResponse.json(
        { error: "Données nappe temporairement indisponibles" },
        { status: 503 }
      )
    }

    console.error('GET /api/meteo/nappe error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données nappe' },
      { status: 500 }
    )
  }
}
