/**
 * PROMPT 12 — Endpoint dédié pour gérer les planches rattachées à une rotation.
 *
 * PUT /api/rotations/[id]/planches  body { plancheIds: string[] }
 *   Remplace l'ensemble des planches rattachées à la rotation.
 *   - Les planches absentes de la liste sont détachées (rotationId=null).
 *   - Les planches présentes sont attachées (rotationId=<id>).
 *   Limité aux planches du user authentifié.
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const { id: rotationId } = await params
  const body = await request.json().catch(() => null)
  const plancheIds: string[] = Array.isArray(body?.plancheIds) ? body.plancheIds : []

  const rotation = await prisma.rotation.findUnique({ where: { id: rotationId } })
  if (!rotation) {
    return NextResponse.json({ error: "Rotation introuvable" }, { status: 404 })
  }

  const userId = session!.user.id

  await prisma.$transaction([
    // Détache toutes les planches actuellement liées (du même user uniquement).
    prisma.planche.updateMany({
      where: { userId, rotationId },
      data: { rotationId: null },
    }),
    // Attache les nouvelles planches demandées (uniquement celles du user).
    plancheIds.length > 0
      ? prisma.planche.updateMany({
          where: { userId, id: { in: plancheIds } },
          data: { rotationId },
        })
      : prisma.planche.updateMany({ where: { id: "__noop__" }, data: {} }),
  ])

  const planches = await prisma.planche.findMany({
    where: { userId, rotationId },
    select: { id: true, nom: true, ilot: true },
    orderBy: { nom: "asc" },
  })

  return NextResponse.json({ planches, count: planches.length })
}
