/**
 * Action en masse "Marquer fait" sur les tâches culture (PROMPT 20a).
 *
 * POST /api/cultures/bulk-fait
 *   body: { ids: number[], type: 'semis' | 'plantation' | 'recolte' }
 *
 * Marque le champ correspondant (semisFait | plantationFaite | recolteFaite)
 * à true pour les cultures de l'utilisateur.
 *
 * Réponse 200 : { updated, ignores, refusees: [{ id, error }], avertissements? }.
 * Une culture dont le recalage de date fait déborder la planche est enregistrée
 * (c'est un fait accompli) et signalée dans `avertissements: [{ id, message }]`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import {
  OPTIONS_TRANSACTION_CULTURE,
  SELECT_ETAPES,
  ecrituresPassageAFait,
  instantPassageAFait,
  verrouillerCultures,
} from '@/lib/cultures/execution'
import type { ChampEtape } from '@/lib/cultures/execution'
import { invalidateKpi } from '@/lib/kpi'
import { refusSiLectureSeule } from '@/lib/exploitation/garde-session'
import {
  SELECT_ETAT_OCCUPATION,
  controlerOccupationModification,
  verrouillerOccupationExploitation,
} from '@/lib/cultures/occupation-modification'

const FIELD_MAP = {
  semis: 'semisFait',
  plantation: 'plantationFaite',
  recolte: 'recolteFaite',
} as const satisfies Record<string, ChampEtape>

const schema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
  type: z.enum(['semis', 'plantation', 'recolte']),
})

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const lectureSeule = refusSiLectureSeule(session)
  if (lectureSeule) return lectureSeule

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { ids, type } = parsed.data
    const field = FIELD_MAP[type]

    // QA cmsoaedw2 — une culture d'ITP en semis direct (pas de semaine de
    // plantation) n'a pas d'étape plantation : on l'ignore silencieusement au
    // lieu de rejeter tout le lot (une sélection mixte reste utilisable). Même
    // règle que la garde du PATCH unitaire.
    const wherePlantationApplicable =
      type === 'plantation'
        ? {
            OR: [
              { itpId: null },
              { datePlantation: { not: null } },
              { itp: { is: { semainePlantation: { not: null } } } },
            ],
          }
        : {}

    // Le where {userId} est appliqué à la sélection pour la sécurité — pas de
    // fuite cross-tenant.
    // QA cmsp66tdm — une étape marquée faite ne peut pas rester datée dans le
    // futur : on lit les dates prévisionnelles pour recaler celles qui le sont.
    // Le recalage mémorise la date de plan, sinon un décochage ultérieur ne
    // pourrait plus la rendre (friction 2026-08-20).
    //
    // Contre-revue PR #73 (revue-adv-97) : un recalage avance le début du cycle
    // et peut faire déborder la planche, que le PATCH unitaire refuse. Tout le
    // lot passe donc sous le verrou d'exploitation commun, dans une seule
    // transaction ; chaque recalage est contrôlé sur l'état final de SA culture
    // face aux cultures relues dans la transaction, donc après les écritures
    // déjà acceptées du même lot (états successifs, pas un instantané antérieur).
    // Une culture refusée n'est pas modifiée et figure dans `refusees`.
    const maintenant = new Date()
    //
    // Contre-revue adverse 2 (2026-11-15) : lecture, recalage et écriture
    // étaient faits hors du verrou commun des étapes. Une redatation en cours
    // (PUT) attendait seule ; le lot reprenait ensuite avec une date lue avant
    // elle et laissait un semis fait daté dans le futur. Ordre global des
    // verrous : exploitation PUIS cultures (ids triés), tous deux AVANT la
    // lecture ; le recalage est calculé depuis l'état relu sous ces verrous.
    const { traitees, refusees, avertissements } = await prisma.$transaction(async (tx) => {
      await verrouillerOccupationExploitation(tx, session.user.id)
      await verrouillerCultures(tx, session.user.id, ids)
      const concernees = await tx.culture.findMany({
        where: { id: { in: ids }, userId: session.user.id, ...wherePlantationApplicable },
        select: { ...SELECT_ETAT_OCCUPATION, ...SELECT_ETAPES },
        orderBy: { id: 'asc' },
      })

      const refusees: Array<{ id: number; error: string }> = []
      const avertissements: Array<{ id: number; message: string }> = []
      const sansRecalage: number[] = []
      let traitees = 0
      for (const culture of concernees) {
        // Même instant de référence que le PATCH unitaire : une récolte cochée
        // se recale sur la première récolte enregistrée si elle est passée.
        const instant = await instantPassageAFait(tx, { userId: session.user.id, cultureId: culture.id, champEtape: field, maintenant })
        const ecritures = ecrituresPassageAFait(culture, field, instant)
        if (Object.keys(ecritures).length === 0) {
          sansRecalage.push(culture.id)
          continue
        }
        // Un fait accompli s'enregistre : le débordement devient un avertissement.
        const { refus, warnings } = await controlerOccupationModification(tx, session.user.id, culture,
          { ...culture, ...ecritures }, { faitAccompli: true })
        if (refus) {
          refusees.push({ id: culture.id, error: refus.error })
          continue
        }
        for (const message of warnings) avertissements.push({ id: culture.id, message })
        await tx.culture.update({
          where: { id: culture.id, userId: session.user.id },
          data: { [field]: true, ...ecritures },
        })
        traitees++
      }
      // Sans recalage, aucune date ne bouge : l'occupation est inchangée.
      if (sansRecalage.length > 0) {
        await tx.culture.updateMany({
          where: { id: { in: sansRecalage }, userId: session.user.id },
          data: { [field]: true },
        })
        traitees += sansRecalage.length
      }
      return { traitees, refusees, avertissements }
    }, OPTIONS_TRANSACTION_CULTURE)

    // La « surface cultivée » des indicateurs compte les cultures dont une étape
    // est faite : même invalidation que le PATCH unitaire.
    if (traitees > 0) invalidateKpi(session.user.id)

    return NextResponse.json({
      updated: traitees,
      ignores: ids.length - traitees - refusees.length,
      refusees,
      ...(avertissements.length > 0 ? { avertissements } : {}),
    })
  } catch (err) {
    console.error('POST /api/cultures/bulk-fait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
