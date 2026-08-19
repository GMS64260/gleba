/**
 * API Route pour les cultures à irriguer — intégration météo complète
 * GET  /api/cultures/irriguer - Liste avec urgence météo-aware
 * PATCH /api/cultures/irriguer - Marquer arrosage / toggle aIrriguer
 *
 * Le calcul (bilan hydrique, urgences, consommations, auto-validation des
 * irrigations planifiées) vit dans src/lib/irrigation-conseil.ts, partagé
 * avec l'assistant IA pour que les deux affichent les mêmes chiffres.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { getUserId, refusSiLectureSeule } from '@/lib/exploitation/garde-session'
import prisma from '@/lib/prisma'
import { enregistrerArrosageCultures } from '@/lib/irrigation-recording'
import { computeConseilIrrigation } from '@/lib/irrigation-conseil'

// ── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const payload = await computeConseilIrrigation(userId, annee)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('GET /api/cultures/irriguer error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des cultures à irriguer', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// ── PATCH ───────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const refus = refusSiLectureSeule(session)
  if (refus) return refus

  try {
    const userId = getUserId(session)
    const body = await request.json()
    const { cultureId, cultureIds, aIrriguer, marquerArrosage } = body

    // Arrosage multiple (groupe par îlot). Chaque culture demandée étend la
    // mise à jour à ses colocataires actifs sur la même planche.
    if (marquerArrosage && cultureIds && Array.isArray(cultureIds)) {
      const result = await enregistrerArrosageCultures({
        userId,
        cultureIds,
      })
      return NextResponse.json({
        success: true,
        ...result,
        date: result.dateEffective,
      })
    }

    // Arrosage simple ou toggle aIrriguer
    if (typeof cultureId !== 'number') {
      return NextResponse.json(
        { error: 'ID de culture requis' },
        { status: 400 }
      )
    }

    // Noter l'arrosage
    if (marquerArrosage) {
      const result = await enregistrerArrosageCultures({
        userId,
        cultureIds: [cultureId],
      })
      if (result.culturesMisesAJour === 0) {
        return NextResponse.json(
          { error: 'Culture non trouvée' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        ...result,
        date: result.dateEffective,
      })
    }

    // Toggle aIrriguer
    const culture = await prisma.culture.findFirst({
      where: { id: cultureId, userId },
      select: { id: true },
    })
    if (!culture) {
      return NextResponse.json(
        { error: 'Culture non trouvée' },
        { status: 404 }
      )
    }

    const updated = await prisma.culture.update({
      where: { id: culture.id },
      data: { aIrriguer },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('PATCH /api/cultures/irriguer error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
