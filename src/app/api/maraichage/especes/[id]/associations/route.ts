/**
 * Associations d'une espèce (PROMPT 23 §1).
 * GET /api/maraichage/especes/[id]/associations
 *   → { data: [{ associationId, nom, description, notes, type, partenaire }] }
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

  // Toutes les associations qui contiennent cette espèce ou sa famille
  const associations = await prisma.association.findMany({
    where: {
      details: { some: { OR: [{ especeId }] } },
    },
    include: { details: { include: { espece: { select: { id: true } } } } },
  })

  const data = associations.flatMap((a) => {
    const lower = a.nom.toLowerCase()
    const type: "favorable" | "defavorable" =
      lower.includes("incompat") || lower.includes("défavorable") || lower.includes("defavorable")
        ? "defavorable"
        : "favorable"
    const partenaires = a.details
      .filter((d) => d.especeId && d.especeId !== especeId)
      .map((d) => d.especeId as string)
    const familles = a.details
      .filter((d) => d.familleId && d.familleId !== especeId)
      .map((d) => d.familleId as string)
    const targets = partenaires.length > 0 ? partenaires : familles
    return targets.map((p) => ({
      associationId: a.id,
      nom: a.nom,
      description: a.description,
      notes: a.notes,
      type,
      partenaire: p,
      niveau: a.details.find((d) => d.especeId === p)?.groupe || "Espèce",
    }))
  })

  return NextResponse.json({ data })
}
