/**
 * Action en masse "Marquer fait" sur les tâches culture (PROMPT 20a).
 *
 * POST /api/cultures/bulk-fait
 *   body: { ids: number[], type: 'semis' | 'plantation' | 'recolte' }
 *
 * Marque le champ correspondant (semisFait | plantationFaite | recolteFaite)
 * à true pour les cultures de l'utilisateur. Renvoie le nombre traités.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { SELECT_ETAPES, ecrituresPassageAFait } from '@/lib/cultures/execution'
import type { ChampEtape } from '@/lib/cultures/execution'

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
    // futur : on lit les dates prévisionnelles pour recaler celles qui le sont,
    // ce qu'un updateMany global ne permet pas. Les cultures sans recalage
    // restent groupées dans un seul updateMany.
    // Select statique (une clé dynamique casse l'inférence du client Prisma).
    // Les six champs de dates : le recalage mémorise la date de plan, sinon un
    // décochage ultérieur ne pourrait plus la rendre (friction 2026-08-20).
    const concernees = await prisma.culture.findMany({
      where: { id: { in: ids }, userId: session.user.id, ...wherePlantationApplicable },
      select: { id: true, ...SELECT_ETAPES },
    })

    const maintenant = new Date()
    const aEcrire: Array<{ id: number; ecritures: Record<string, Date | null> }> = []
    const sansRecalage: number[] = []
    for (const culture of concernees) {
      const ecritures = ecrituresPassageAFait(culture, field, maintenant)
      if (Object.keys(ecritures).length > 0) aEcrire.push({ id: culture.id, ecritures })
      else sansRecalage.push(culture.id)
    }

    await prisma.$transaction([
      ...(sansRecalage.length > 0
        ? [
            prisma.culture.updateMany({
              where: { id: { in: sansRecalage }, userId: session.user.id },
              data: { [field]: true },
            }),
          ]
        : []),
      ...aEcrire.map(({ id, ecritures }) =>
        prisma.culture.update({
          where: { id },
          data: { [field]: true, ...ecritures },
        }),
      ),
    ])

    return NextResponse.json({ updated: concernees.length, ignores: ids.length - concernees.length })
  } catch (err) {
    console.error('POST /api/cultures/bulk-fait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
