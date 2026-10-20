/**
 * API Route pour les cultures à irriguer — intégration météo complète
 * GET  /api/cultures/irriguer - Liste avec urgence météo-aware
 * PATCH /api/cultures/irriguer - Marquer arrosage (avec ou sans litres versés), l'annuler / toggle aIrriguer
 *
 * Le calcul (bilan hydrique, urgences, consommations) vit dans
 * src/lib/irrigation-conseil.ts, partagé avec l'assistant IA pour que les
 * deux affichent les mêmes chiffres.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { getUserId, refusSiLectureSeule } from '@/lib/exploitation/garde-session'
import prisma from '@/lib/prisma'
import {
  annulerArrosageCultures,
  annulerArrosageMesure,
  enregistrerArrosageCultures,
  enregistrerArrosageMesure,
  supprimerArrosageNote,
} from '@/lib/irrigation-recording'
import { computeConseilIrrigation } from '@/lib/irrigation-conseil'
import { tourneeDuJour } from '@/lib/irrigation/a-arroser'

// ── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const annee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    const payload = await computeConseilIrrigation(userId, annee)
    // QA cmvge3o5z — « À arroser aujourd'hui » comptait toutes les urgences,
    // cultures non cochées « à irriguer » comprises, quand la page Tâches n'en
    // retient que les cochées : même tournée ici, avec ce qu'elle écarte.
    return NextResponse.json({ ...payload, tournee: tourneeDuJour(payload.data, annee) })
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
    const notes = typeof body.notes === 'string' ? body.notes : null

    // Annuler un arrosage noté avec sa quantité : l'intervention créée.
    if (body.annulerArrosage === true && body.interventionId !== undefined) {
      const interventionId = Number(body.interventionId)
      if (!Number.isInteger(interventionId) || interventionId <= 0) {
        return NextResponse.json({ error: 'interventionId invalide' }, { status: 400 })
      }
      const result = await annulerArrosageMesure({ userId, interventionId })
      return NextResponse.json({ success: true, ...result })
    }

    // Annuler un arrosage noté (inverse exact, revue du 2026-10-10).
    if (body.annulerArrosage === true) {
      const dateEffective = new Date(body.dateEffective)
      const avant = body.avant && typeof body.avant === 'object' ? (body.avant as Record<number, string | null>) : null
      if (Number.isNaN(dateEffective.getTime()) || !avant) {
        return NextResponse.json({ error: 'dateEffective et avant requis' }, { status: 400 })
      }
      const result = await annulerArrosageCultures({ userId, dateEffective, avant })
      return NextResponse.json({ success: true, ...result })
    }

    // Arrosage multiple (groupe par îlot). Chaque culture demandée étend la
    // mise à jour à ses colocataires actifs sur la même planche.
    if (marquerArrosage && cultureIds && Array.isArray(cultureIds)) {
      // Quantité versée connue (ticket QA cmv3japsf) : le bilan retranche ces
      // litres au lieu de remettre la réserve pleine.
      if (body.litres !== undefined && body.litres !== null) {
        const mesure = await enregistrerArrosageMesure({ userId, cultureIds, litres: Number(body.litres), notes })
        if (!mesure.ok) {
          return NextResponse.json({ error: mesure.erreur }, { status: mesure.erreur === 'Culture non trouvée' ? 404 : 400 })
        }
        return NextResponse.json({ success: true, ...mesure })
      }
      const result = await enregistrerArrosageCultures({
        userId,
        cultureIds,
        notes,
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

// ── DELETE ──────────────────────────────────────────────────
// Supprime un arrosage noté (ligne « via Irrigations » du registre).

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const refus = refusSiLectureSeule(session)
  if (refus) return refus

  try {
    const userId = getUserId(session)
    const traceId = Number(new URL(request.url).searchParams.get('traceId'))
    if (!Number.isInteger(traceId) || traceId <= 0) {
      return NextResponse.json({ error: 'traceId requis' }, { status: 400 })
    }
    const result = await supprimerArrosageNote({ userId, traceId })
    if (!result.supprime) {
      return NextResponse.json({ error: 'Arrosage noté introuvable' }, { status: 404 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('DELETE /api/cultures/irriguer error:', error)
    return NextResponse.json({ error: "Impossible de supprimer l'arrosage" }, { status: 500 })
  }
}
