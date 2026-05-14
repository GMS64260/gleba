/**
 * GET /api/verger/bioagresseurs[?type=Maladie|Ravageur|Adventice][?especeId=...]
 *
 * PROMPT DEV 2 Bug #4 — Sous-référentiel bioagresseurs.
 *
 * Retourne tous les bioagresseurs du référentiel verger avec leurs espèces
 * cibles. Filtres optionnels : type (Maladie/Ravageur/Adventice), especeId.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const type = sp.get("type")
  const especeId = sp.get("especeId")

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (especeId) where.especes = { some: { especeId } }

  const bioagresseurs = await prisma.bioagresseur.findMany({
    where,
    select: {
      id: true,
      nomCommun: true,
      nomLatin: true,
      type: true,
      organeCible: true,
      periodePression: true,
      methodesPbi: true,
      seuilNuisibilite: true,
      notes: true,
      especes: { select: { especeId: true } },
    },
    orderBy: [{ type: "asc" }, { nomCommun: "asc" }],
  })

  const flat = bioagresseurs.map((b) => ({
    ...b,
    especesCibles: b.especes.map((e) => e.especeId),
  }))

  return NextResponse.json({ data: flat, count: flat.length })
}
