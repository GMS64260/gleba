/**
 * API Route - Proxy vers l'API Carto IGN (Cadastre)
 * GET /api/carte/cadastre - Recherche de parcelles cadastrales
 *
 * Proxy côté serveur vers l'API publique IGN pour éviter les problèmes CORS
 * et centraliser la logique de requête.
 */

import { NextRequest, NextResponse } from 'next/server'

const IGN_CADASTRE_URL = 'https://apicarto.ign.fr/api/cadastre/parcelle'

// GET /api/carte/cadastre?commune=25056&section=AB&numero=0123
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const commune = searchParams.get('commune')
    const section = searchParams.get('section')
    const numero = searchParams.get('numero')

    // Le code INSEE de la commune est obligatoire
    if (!commune) {
      return NextResponse.json(
        { error: 'Le paramètre "commune" (code INSEE) est obligatoire' },
        { status: 400 }
      )
    }

    // Validation basique du code INSEE (5 chiffres)
    if (!/^\d{5}$/.test(commune)) {
      return NextResponse.json(
        { error: 'Le code INSEE doit contenir exactement 5 chiffres' },
        { status: 400 }
      )
    }

    // Construction de l'URL avec les parametres
    const params = new URLSearchParams({ code_insee: commune })
    if (section) params.append('section', section.toUpperCase())
    if (numero) params.append('numero', numero)

    const url = `${IGN_CADASTRE_URL}?${params.toString()}`

    // Appel à l'API IGN
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // Timeout de 15 secondes pour l'API IGN
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      // Gestion des erreurs de l'API IGN
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Aucune parcelle trouvée pour ces critères' },
          { status: 404 }
        )
      }
      if (response.status === 400) {
        return NextResponse.json(
          { error: 'Paramètres de recherche invalides' },
          { status: 400 }
        )
      }
      console.error(`API IGN erreur ${response.status}:`, await response.text().catch(() => ''))
      return NextResponse.json(
        { error: 'L\'API IGN est temporairement indisponible' },
        { status: 502 }
      )
    }

    const geojson = await response.json()

    // Filtrer le résultat pour ne garder que les données utiles
    // L'API retourne un FeatureCollection GeoJSON
    const filtered = {
      type: geojson.type,
      features: (geojson.features || []).map((feature: {
        type: string
        geometry: { type: string; coordinates: number[][][] | number[][][][] }
        properties: Record<string, unknown>
      }) => ({
        type: feature.type,
        geometry: feature.geometry,
        properties: feature.properties,
      })),
    }

    return NextResponse.json(filtered)
  } catch (err) {
    // Gestion du timeout
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'L\'API IGN n\'a pas répondu dans le délai imparti' },
        { status: 504 }
      )
    }

    // Gestion des erreurs réseau
    if (err instanceof TypeError && (err as Error).message?.includes('fetch')) {
      return NextResponse.json(
        { error: 'Impossible de contacter l\'API IGN' },
        { status: 502 }
      )
    }

    console.error('GET /api/carte/cadastre error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la recherche cadastrale' },
      { status: 500 }
    )
  }
}
