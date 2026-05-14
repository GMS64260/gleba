/**
 * API Route - Recherche de communes (auto-complétion)
 * GET /api/carte/communes - Recherche par nom de commune
 *
 * Proxy vers l'API geo.api.gouv.fr pour la recherche de communes françaises
 * avec code INSEE et coordonnées du centre.
 */

import { NextRequest, NextResponse } from 'next/server'

const GEO_API_URL = 'https://geo.api.gouv.fr/communes'

// GET /api/carte/communes?q=Besançon
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    // Le parametre de recherche est obligatoire
    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le paramètre "q" (nom de commune) est obligatoire' },
        { status: 400 }
      )
    }

    // Minimum 2 caractères pour la recherche
    if (q.trim().length < 2) {
      return NextResponse.json(
        { error: 'Le nom de commune doit contenir au moins 2 caractères' },
        { status: 400 }
      )
    }

    // Construction de l'URL geo.api.gouv.fr
    const params = new URLSearchParams({
      nom: q.trim(),
      fields: 'nom,code,codesPostaux,centre',
      limit: '10',
    })

    const url = `${GEO_API_URL}?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // Timeout de 10 secondes
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`API Geo erreur ${response.status}:`, await response.text().catch(() => ''))
      return NextResponse.json(
        { error: 'L\'API Geo est temporairement indisponible' },
        { status: 502 }
      )
    }

    const communes = await response.json()

    return NextResponse.json(communes)
  } catch (err) {
    // Gestion du timeout
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'L\'API Geo n\'a pas répondu dans le délai imparti' },
        { status: 504 }
      )
    }

    // Gestion des erreurs réseau
    if (err instanceof TypeError && (err as Error).message?.includes('fetch')) {
      return NextResponse.json(
        { error: 'Impossible de contacter l\'API Geo' },
        { status: 502 }
      )
    }

    console.error('GET /api/carte/communes error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la recherche de communes' },
      { status: 500 }
    )
  }
}
