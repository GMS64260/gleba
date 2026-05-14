/**
 * API Route pour les statistiques de planification
 * GET /api/planification/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { getStatsPlanification } from '@/lib/planification'
import { getKpiMaraichage } from '@/lib/kpi'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())
    const asOf = new Date()

    // getStatsPlanification fournit toujours les compteurs purement
    // planification (totalCultures, culturesExistantes/ACreer, recoltesTotales
    // prévisionnelles). Pour la surface affichée à l'écran, on bascule sur la
    // source unique de vérité (`getKpiMaraichage`) afin que tous les onglets
    // (CalendrierTab, PlanificationTab, accueil) affichent la même valeur.
    const [stats, kpi] = await Promise.all([
      getStatsPlanification(userId, annee),
      getKpiMaraichage(userId, annee, asOf),
    ])

    return NextResponse.json({
      ...stats,
      surfaceTotale: kpi.surfacePlanifieeM2,
      surfaceCultivee: kpi.surfaceCultiveeM2,
      surfacePlanifiee: kpi.surfacePlanifieeM2,
      annee,
    })
  } catch (error) {
    console.error('GET /api/planification/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des statistiques', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
