/**
 * GET /api/carte/localisation-exemple
 *
 * Le compte a-t-il bâti des données réelles sur la parcelle d'exemple, restée
 * géolocalisée à Paris 4ᵉ ? Lecture seule, sert à afficher un bandeau de
 * recalage sur la carte — jamais à modifier quoi que ce soit.
 */

import { NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { detecterLocalisationARecaler } from '@/lib/localisation-exemple'

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const resultat = await detecterLocalisationARecaler(getUserId(session))
    return NextResponse.json(resultat)
  } catch (err) {
    console.error('GET /api/carte/localisation-exemple error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification de la localisation' },
      { status: 500 }
    )
  }
}
