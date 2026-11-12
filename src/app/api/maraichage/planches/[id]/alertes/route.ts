/**
 * Alertes association pour une planche (PROMPT 23 §3).
 *
 * GET /api/maraichage/planches/[id]/alertes
 *   → { alertes: AlerteAssociation[], cultures: [{ id, especeId, varieteId }] }
 *
 * Critère : les cultures réellement sur la planche aujourd'hui (`estEnPlace`,
 * règle partagée avec l'assistant et l'irrigation). La case « récolte faite »
 * seule écartait une culture en cours de récolte et gardait une campagne
 * ancienne jamais close.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { alertesAssociations } from "@/lib/associations-alertes"
import { SELECT_EN_PLACE, estEnPlace } from "@/lib/cultures/en-place"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id } = await params

  try {
    const lues = await prisma.culture.findMany({
      where: {
        userId: session.user.id,
        plancheId: id,
        // Les cultures closes sont écartées en base ; le reste se décide sur
        // les dates, en mémoire.
        terminee: null,
      },
      select: {
        id: true,
        especeId: true,
        varieteId: true,
        ...SELECT_EN_PLACE,
        espece: { select: { vivace: true } },
      },
      orderBy: { id: "asc" },
    })

    const maintenant = new Date()
    const cultures = lues
      .filter((c) => estEnPlace(c, maintenant))
      .map((c) => ({ id: c.id, especeId: c.especeId, varieteId: c.varieteId }))

    const especesIds = cultures.map((c) => c.especeId).filter(Boolean) as string[]
    const alertes = await alertesAssociations(prisma, especesIds)

    return NextResponse.json({ alertes, cultures })
  } catch (e) {
    console.error("GET /api/maraichage/planches/[id]/alertes error:", e)
    return NextResponse.json(
      { error: "Erreur lors du calcul des alertes d'association de la planche" },
      { status: 500 }
    )
  }
}
