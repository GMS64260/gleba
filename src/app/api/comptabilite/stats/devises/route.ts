/**
 * GET /api/comptabilite/stats/devises?year=AAAA
 *
 * Même réponse que GET /api/comptabilite/stats (contrat devise du lot
 * devise-totaux-api : voisins `…ParDevise`, totaux `null` en multi-devise,
 * `facturesImpayeesParDevise`), calculée par le même module public.
 *
 * Pourquoi une seconde route : `stats/route.ts` est une surcharge de la zone
 * privée ; le dépôt public garde sa version de main, sans ventilation par
 * devise. L'écran Comptabilité lit cette route quand la réponse de
 * GET /api/comptabilite/stats ne porte pas `revenusParDevise`.
 * Mêmes garde (session, module Comptabilité) et cloisonnement par exploitation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { calculerStatsExercice } from '@/lib/comptabilite/stats-exercice'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const brut = new URL(request.url).searchParams.get('year')
  const year = brut === null ? new Date().getFullYear() : Number(brut)
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return NextResponse.json({ error: 'Année invalide' }, { status: 400 })
  }
  try {
    return NextResponse.json(await calculerStatsExercice(session.user.id, year, new Date()))
  } catch (error) {
    console.error('GET /api/comptabilite/stats/devises error:', error)
    return NextResponse.json({ error: 'Erreur lors de la récupération des stats' }, { status: 500 })
  }
}
