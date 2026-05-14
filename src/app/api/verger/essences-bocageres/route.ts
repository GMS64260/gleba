/**
 * GET /api/verger/essences-bocageres[?role=brise-vent|mellifère|...]
 *
 * PROMPT DEV 2 Bug #4 — Sous-référentiel essences bocagères/forestières.
 *
 * Pour l'onglet Référentiel : toutes les essences avec leurs rôles
 * écologiques (brise-vent, mellifère, refuge auxiliaires, bois énergie…).
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const role = sp.get("role")

  const where: Record<string, unknown> = {}
  if (role) where.roles = { has: role }

  const essences = await prisma.essenceBocagere.findMany({
    where,
    orderBy: [{ nomCommun: "asc" }],
  })

  return NextResponse.json({ data: essences, count: essences.length })
}
