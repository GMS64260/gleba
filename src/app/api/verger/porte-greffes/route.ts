/**
 * GET /api/verger/porte-greffes?especeId=<Pommier|Poirier|...>
 *
 * Retourne les porte-greffes adaptés à une espèce fruitière donnée
 * (relation many-to-many `porte_greffe_especes`). Utilisé dans l'Assistant
 * Plantation pour proposer un dropdown contextuel.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const especeId = searchParams.get("especeId")

  if (!especeId) {
    return NextResponse.json({ error: "Paramètre 'especeId' requis" }, { status: 400 })
  }

  const portesGreffe = await prisma.porteGreffe.findMany({
    where: { especes: { some: { especeId } } },
    select: {
      id: true,
      nom: true,
      vigueur: true,
      precocite: true,
      sensibilites: true,
      drageonnement: true,
      notes: true,
    },
    orderBy: { vigueur: "asc" },
  })

  return NextResponse.json({ data: portesGreffe, count: portesGreffe.length })
}
