/**
 * GET /api/verger/porte-greffes[?especeId=<Pommier|Poirier|...>]
 *
 * - Avec `especeId` : retourne les porte-greffes adaptés à cette espèce
 *   (relation many-to-many `porte_greffe_especes`). Utilisé dans l'Assistant
 *   Plantation et dans la fiche Arbre pour le dropdown contextuel.
 * - Sans `especeId` (Bug #4) : retourne tous les porte-greffes avec leurs
 *   espèces compatibles, pour l'onglet Référentiel.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const especeId = searchParams.get("especeId")

  if (especeId) {
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

  // Bug #4 — Référentiel global avec les espèces compatibles incluses.
  const all = await prisma.porteGreffe.findMany({
    select: {
      id: true,
      nom: true,
      vigueur: true,
      precocite: true,
      sensibilites: true,
      drageonnement: true,
      notes: true,
      especes: { select: { especeId: true } },
    },
    orderBy: [{ nom: "asc" }],
  })
  const flat = all.map((pg) => ({
    ...pg,
    especesCompatibles: pg.especes.map((e) => e.especeId),
  }))
  return NextResponse.json({ data: flat, count: flat.length })
}
