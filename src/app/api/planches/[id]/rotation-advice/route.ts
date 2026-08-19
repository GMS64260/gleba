/**
 * API Conseils de rotation pour une planche
 * GET /api/planches/[id]/rotation-advice
 *
 * Le chargement et le calcul vivent dans src/lib/rotation/planche-advice.ts,
 * partagés avec l'assistant IA pour que les deux surfaces annoncent la même
 * année de retour (QA cmsfyxhk5).
 */

import { NextRequest, NextResponse } from 'next/server'
import { conseilRotationPlanche } from '@/lib/rotation/planche-advice'
import { requireAuthApi } from '@/lib/auth-utils'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const plancheId = decodeURIComponent(id)

    const { searchParams } = new URL(request.url)
    const targetYear = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
    const especeId = searchParams.get('especeId')

    const resultat = await conseilRotationPlanche(
      plancheId,
      session!.user.id,
      targetYear,
      especeId
    )

    if (!resultat) {
      return NextResponse.json({ error: 'Planche non trouvée' }, { status: 404 })
    }

    return NextResponse.json(resultat.advice)
  } catch (error) {
    console.error('Erreur GET rotation-advice:', error)
    return NextResponse.json(
      { error: 'Erreur lors du calcul des conseils de rotation' },
      { status: 500 }
    )
  }
}
