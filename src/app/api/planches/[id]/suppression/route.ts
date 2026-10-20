/**
 * GET /api/planches/[id]/suppression — la planche peut-elle être supprimée ?
 *
 * Vérification préalable de l'écran Planches, sans rien supprimer. QA
 * cmvgdp9fn (2026-10-20) : l'écran refusait seul dès qu'il voyait des cultures,
 * avec son propre texte (« v8-Marc-2010 a 4 culture(s) associée(s) »), sans les
 * années où les retrouver ; le refus de la route, qui les nomme, n'était
 * jamais affiché. L'écran demande désormais ici, avant de confirmer, le même
 * refus que DELETE (`refusSuppressionPlanche`) : un seul message, produit par
 * le serveur. DELETE garde sa propre garde (409), qui fait foi.
 *
 * Réponse : `{ supprimable: true, fertilisations }` (fertilisations importées
 * qui partiront avec la planche, à annoncer à la confirmation) ou
 * `{ supprimable: false, error, details, lien }`.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { resoudreIdPlanche } from '@/lib/planches/resolution'
import { compterTracesPlanches, refusSuppressionPlanche } from '@/lib/planches/traces'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const { id } = await params
    const reference = decodeURIComponent(id)
    const plancheId = await resoudreIdPlanche(prisma, reference, userId)
    const planche = plancheId
      ? await prisma.planche.findUnique({
          where: { id: plancheId },
          select: { id: true, nom: true, _count: { select: { fertilisations: true } } },
        })
      : null
    if (!planche) {
      return NextResponse.json({ error: `Planche "${reference}" non trouvée` }, { status: 404 })
    }

    const traces = (await compterTracesPlanches(prisma, [planche], userId)).get(planche.id)!
    const refus = refusSuppressionPlanche(planche, traces)
    if (refus) return NextResponse.json({ supprimable: false, ...refus })

    return NextResponse.json({ supprimable: true, fertilisations: planche._count.fertilisations })
  } catch (error) {
    console.error('GET /api/planches/[id]/suppression error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification de la planche' },
      { status: 500 }
    )
  }
}
