/**
 * POST /api/irrigations/generate
 * Génère les irrigations planifiées pour les cultures actives
 * ?cultureId=X pour une seule culture
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { genererIrrigationsPlanifiees } from '@/lib/irrigation-scheduler'

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const cultureIdStr = searchParams.get('cultureId')
    const cultureId = cultureIdStr ? parseInt(cultureIdStr, 10) : undefined

    const result = await genererIrrigationsPlanifiees(userId, cultureId)

    return NextResponse.json({
      success: true,
      ...result,
      message: result.created > 0
        ? `${result.created} irrigations planifiées créées pour ${result.cultures - result.skipped} culture(s).`
        : 'Aucune nouvelle irrigation à planifier.',
    })
  } catch (err) {
    console.error('POST /api/irrigations/generate error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération des irrigations' },
      { status: 500 }
    )
  }
}
