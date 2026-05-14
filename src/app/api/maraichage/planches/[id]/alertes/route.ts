/**
 * Alertes association pour une planche (PROMPT 23 §3).
 *
 * GET /api/maraichage/planches/[id]/alertes
 *   → { alertes: AlerteAssociation[], cultures: [{ id, especeId, varieteId }] }
 *
 * Critère : on prend toutes les cultures ACTIVES (non récoltées) sur la planche
 * et on cherche les paires favorables/défavorables.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { alertesAssociations } from "@/lib/associations-alertes"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { id } = await params

  const cultures = await prisma.culture.findMany({
    where: {
      userId: session.user.id,
      plancheId: id,
      // Cultures encore "en place" : pas récolte effectuée, ou récolte en cours
      OR: [{ recolteFaite: false }, { recolteFaite: null as any }],
    },
    select: { id: true, especeId: true, varieteId: true },
  })

  const especesIds = cultures.map((c) => c.especeId).filter(Boolean) as string[]
  const alertes = await alertesAssociations(prisma, especesIds)

  return NextResponse.json({ alertes, cultures })
}
