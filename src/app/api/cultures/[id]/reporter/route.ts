/**
 * POST /api/cultures/[id]/reporter — reporter une étape non faite à une
 * nouvelle date, en décalant le reste du cycle du même nombre de jours.
 *
 * Friction 2026-08-23 : sans action de report là où le retard s'affiche, un
 * maraîcher a supprimé ses cultures en retard puis recréé les mêmes variétés à
 * dates fraîches. Le calcul vit dans lib/cultures/report.ts (testé) ; cette
 * route ne fait que l'appliquer sous les gardes habituelles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { refusSiLectureSeule } from '@/lib/exploitation/garde-session'
import { SELECT_ETAPES } from '@/lib/cultures/execution'
import { ecrituresReport } from '@/lib/cultures/report'
import { invalidateKpi } from '@/lib/kpi'
import { etendrePlanArrosage } from '@/lib/irrigation-scheduler'

type RouteParams = { params: Promise<{ id: string }> }

const reportSchema = z.object({
  etape: z.enum(['semis', 'plantation', 'recolte']),
  date: z.union([z.string(), z.date()]),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const refus = refusSiLectureSeule(session)
  if (refus) return refus

  try {
    const { id } = await params
    const cultureId = parseInt(id)
    if (isNaN(cultureId)) {
      return NextResponse.json({ error: 'ID de culture invalide' }, { status: 400 })
    }

    const parse = reportSchema.safeParse(await request.json())
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parse.error.flatten() },
        { status: 400 }
      )
    }
    const nouvelleDate = new Date(parse.data.date)
    if (Number.isNaN(nouvelleDate.getTime())) {
      return NextResponse.json({ error: 'Date invalide' }, { status: 400 })
    }

    const culture = await prisma.culture.findUnique({
      where: { id: cultureId, userId: session!.user.id },
      select: {
        id: true,
        aIrriguer: true,
        semisFait: true,
        plantationFaite: true,
        recolteFaite: true,
        terminee: true,
        ...SELECT_ETAPES,
      },
    })
    if (!culture) {
      return NextResponse.json({ error: `Culture #${id} non trouvée` }, { status: 404 })
    }

    const resultat = ecrituresReport(culture, parse.data.etape, nouvelleDate)
    if (!resultat.ok) {
      return NextResponse.json({ error: resultat.erreur }, { status: 400 })
    }

    const maj = await prisma.culture.update({
      where: { id: cultureId },
      data: resultat.ecritures,
      include: { espece: true, variete: true, planche: true },
    })

    invalidateKpi(session!.user.id)

    // Friction 2026-08-14 — un plan d'arrosage existant suit les cultures :
    // un cycle déplacé doit re-couvrir sa nouvelle fenêtre.
    if (maj.aIrriguer) {
      await etendrePlanArrosage(session!.user.id, cultureId)
    }

    return NextResponse.json({ culture: maj, decalages: resultat.decalages })
  } catch (error) {
    console.error('POST /api/cultures/[id]/reporter error:', error)
    return NextResponse.json(
      { error: "Erreur lors du report de l'étape" },
      { status: 500 }
    )
  }
}
