/**
 * API Route - Recherche de communes (auto-complétion)
 * GET /api/carte/communes - Recherche par nom de commune
 *
 * Proxy vers l'API geo.api.gouv.fr pour la recherche de communes françaises
 * avec code INSEE et coordonnées du centre.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GeoApiHttpError, rechercherCommunes } from '@/lib/carte/communes'

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

    const communes = await rechercherCommunes(q)
    return NextResponse.json(communes)
  } catch (err) {
    if (err instanceof GeoApiHttpError) {
      return NextResponse.json(
        { error: 'L\'API Geo est temporairement indisponible' },
        { status: 502 }
      )
    }
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
