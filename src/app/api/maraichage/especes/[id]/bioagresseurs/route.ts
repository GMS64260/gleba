/**
 * Bioagresseurs d'une espèce (PROMPT 23 §1).
 * GET /api/maraichage/especes/[id]/bioagresseurs
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireAuthApi()
  if (error) return error
  const { id } = await params
  const especeId = decodeURIComponent(id)

  const rels = await prisma.bioagresseurEspece.findMany({
    where: { especeId },
    include: { bioagresseur: true },
  })

  const data = rels.map((r) => ({
    id: r.bioagresseur.id,
    nom: r.bioagresseur.nomCommun,
    type: r.bioagresseur.type,
    periode: (r.bioagresseur.periodePression || []).join(", "),
    methodesPbi: r.bioagresseur.methodesPbi || [],
    description: r.bioagresseur.notes,
  }))

  return NextResponse.json({ data })
}
