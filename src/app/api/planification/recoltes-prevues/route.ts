/**
 * API Route pour les recoltes prevues
 * GET /api/planification/recoltes-prevues
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getRecoltesPrevues } from '@/lib/planification'
import { getRecoltesAnneeAggregat } from '@/lib/kpi/recoltes-annee'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const groupBy = (searchParams.get('groupBy') || 'mois') as 'mois' | 'semaine'

    // BUG-03 : projection détaillée (utilisée pour le tableau par mois/sem
    // avec breakdown par espèce) + agrégat unifié (réalisé + projection)
    // utilisé par les 3 écrans Planif / Calendrier / Récoltes.
    const [recoltesPrevues, aggregat] = await Promise.all([
      getRecoltesPrevues(userId, annee, groupBy),
      getRecoltesAnneeAggregat(userId, annee),
    ])

    const projectionAnnee = recoltesPrevues.reduce((sum, r) => sum + r.totalKg, 0)
    const surfaceTotale = recoltesPrevues.reduce((sum, r) => sum + r.totalSurface, 0)

    // Trouver les mois/semaines avec le plus de recoltes
    const meilleurePeriode = recoltesPrevues.reduce((max, r) =>
      r.totalKg > max.totalKg ? r : max,
      { periode: '', totalKg: 0 }
    )

    return NextResponse.json({
      data: recoltesPrevues,
      stats: {
        // Compat ancien front : totalAnnee = projection pure (champ déjà utilisé).
        totalAnnee: Math.round(projectionAnnee * 100) / 100,
        // BUG-03 : nouveaux champs unifiés (alignés avec Dashboard/Calendrier).
        realiseesKg: aggregat.realiseesKg,
        projectionKg: aggregat.projectionKg,
        totalAttenduKg: aggregat.totalAttenduKg,
        surfaceTotale: Math.round(surfaceTotale * 100) / 100,
        meilleurePeriode: meilleurePeriode.periode,
        meilleureQuantite: Math.round(meilleurePeriode.totalKg * 100) / 100,
      },
      annee,
      groupBy,
    })
  } catch (error) {
    console.error('GET /api/planification/recoltes-prevues error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des recoltes prevues', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
