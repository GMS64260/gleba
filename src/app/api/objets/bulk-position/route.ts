/**
 * Mise à jour en masse des positions/rotations d'objets jardin (POSTREVIEW Sprint 7).
 *
 * PUT /api/objets/bulk-position
 *   body: { updates: [{ id: number, posX?, posY?, rotation2D? }] }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  updates: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        posX: z.coerce.number().optional(),
        posY: z.coerce.number().optional(),
        rotation2D: z.coerce.number().optional(),
      })
    )
    .min(1)
    .max(500),
})

export async function PUT(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 })
    }
    const userId = session.user.id

    const results = await prisma.$transaction(
      parsed.data.updates.map((u) => {
        const data: any = {}
        if (u.posX !== undefined) data.posX = u.posX
        if (u.posY !== undefined) data.posY = u.posY
        if (u.rotation2D !== undefined) data.rotation2D = u.rotation2D
        return prisma.objetJardin.updateMany({
          where: { id: u.id, userId },
          data,
        })
      })
    )
    const updated = results.reduce((s, r) => s + r.count, 0)
    return NextResponse.json({ updated })
  } catch (err) {
    console.error("PUT /api/objets/bulk-position error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
