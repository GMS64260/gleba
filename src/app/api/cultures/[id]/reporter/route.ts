/**
 * POST /api/cultures/[id]/reporter — reporter une étape non faite à une
 * nouvelle date, en décalant le reste du cycle du même nombre de jours.
 *
 * Friction 2026-08-23 : sans action de report là où le retard s'affiche, un
 * maraîcher a supprimé ses cultures en retard puis recréé les mêmes variétés à
 * dates fraîches. Le calcul vit dans lib/cultures/report.ts (testé) ; cette
 * route ne fait que l'appliquer sous les gardes habituelles, dont le contrôle
 * d'occupation de la planche (400 si le cycle reporté la fait déborder).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { refusSiLectureSeule } from '@/lib/exploitation/garde-session'
import { OPTIONS_TRANSACTION_CULTURE, SELECT_ETAPES, verrouillerCultures } from '@/lib/cultures/execution'
import { ecrituresReport } from '@/lib/cultures/report'
import { invalidateKpi } from '@/lib/kpi'
import { masquerReferentielsEmbarques } from '@/lib/referentiel-embarque'
import {
  SELECT_ETAT_OCCUPATION,
  controlerOccupationModification,
  verrouillerOccupationExploitation,
} from '@/lib/cultures/occupation-modification'

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

    // Contre-revue PR #73 (revue-adv-97) : le report déplace tout le cycle et
    // pouvait poser la culture sur une planche pleine que le PATCH refuse.
    // Relecture, calcul, contrôle de l'état final et écriture se font dans une
    // transaction, sous le verrou d'exploitation commun aux mutations
    // d'occupation (POST, PUT, PATCH, bulk-fait).
    // Contre-revue adverse 2 (2026-11-15) : « l'étape n'est pas faite » était
    // lu hors du verrou commun des étapes ; un PUT qui la cochait pendant ce
    // temps voyait ensuite son étape faite redatée dans le futur par le report.
    // Ordre global : exploitation PUIS culture, tous deux AVANT la lecture.
    const userId = session!.user.id
    const issue = await prisma.$transaction(async (tx) => {
      await verrouillerOccupationExploitation(tx, userId)
      await verrouillerCultures(tx, userId, [cultureId])
      const culture = await tx.culture.findUnique({
        where: { id: cultureId, userId },
        select: {
          ...SELECT_ETAT_OCCUPATION,
          aIrriguer: true,
          semisFait: true,
          plantationFaite: true,
          recolteFaite: true,
          ...SELECT_ETAPES,
        },
      })
      if (!culture) {
        return { reponse: NextResponse.json({ error: `Culture #${id} non trouvée` }, { status: 404 }) }
      }

      const resultat = ecrituresReport(culture, parse.data.etape, nouvelleDate)
      if (!resultat.ok) {
        return { reponse: NextResponse.json({ error: resultat.erreur }, { status: 400 }) }
      }

      const { refus } = await controlerOccupationModification(tx, userId, culture,
        { ...culture, ...resultat.ecritures })
      if (refus) return { reponse: NextResponse.json(refus, { status: 400 }) }

      const maj = await tx.culture.update({
        where: { id: cultureId, userId },
        data: resultat.ecritures,
        include: { espece: true, variete: true, planche: true },
      })
      return { maj, decalages: resultat.decalages }
    }, OPTIONS_TRANSACTION_CULTURE)
    if (issue.reponse) return issue.reponse

    invalidateKpi(userId)

    return NextResponse.json({
      culture: masquerReferentielsEmbarques(issue.maj, userId),
      decalages: issue.decalages,
    })
  } catch (error) {
    console.error('POST /api/cultures/[id]/reporter error:', error)
    return NextResponse.json(
      { error: "Erreur lors du report de l'étape" },
      { status: 500 }
    )
  }
}
