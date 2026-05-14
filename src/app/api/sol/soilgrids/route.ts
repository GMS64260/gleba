import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { fetchSoilData } from '@/lib/soilgrids'
import { determinerTypeSol, calculerRetentionEau } from '@/lib/soil-quality'

/**
 * GET /api/sol/soilgrids?lat=X&lng=Y
 * Retourne les propriétés du sol estimées par SoilGrids (ISRIC)
 * Résolution 250m, couche 0-5cm
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

    const soilData = await fetchSoilData(lat, lng)

    if (!soilData) {
      return NextResponse.json(
        { error: 'Données sol indisponibles pour ces coordonnées' },
        { status: 404 }
      )
    }

    // Calculer le type de sol et la rétention via les fonctions existantes
    const typeSol = determinerTypeSol(soilData.argile, soilData.limon, soilData.sable)
    const { niveau: retentionEau, score: scoreRetention } = calculerRetentionEau(
      soilData.argile, soilData.limon, soilData.sable
    )

    return NextResponse.json({
      source: 'SoilGrids (ISRIC)',
      resolution: '250m',
      profondeur: '0-5cm',
      donnees: {
        argile: soilData.argile,
        limon: soilData.limon,
        sable: soilData.sable,
        ph: soilData.ph,
        carboneOrg: soilData.carboneOrg,
      },
      calculs: {
        typeSol,
        retentionEau,
        scoreRetention,
      },
      coordonnees: { lat, lng },
    })
  } catch (err) {
    console.error('GET /api/sol/soilgrids error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données sol' },
      { status: 500 }
    )
  }
}
