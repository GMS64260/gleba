/**
 * PROMPT DEV 2 Bug #11 — Bulk update planches.
 *
 * POST /api/planches/bulk-update  body { updates: [{ id, ...fields }] }
 *
 * Permet de compléter en masse les champs métadonnées des planches : type,
 * typeSol, retentionEau, ilot, rotationId. Restreint aux planches du user.
 *
 * Pourquoi un endpoint dédié plutôt que N PUT en parallèle :
 *   - une seule transaction → cohérence ou rollback total
 *   - une seule auth → moins de surcoût
 *   - permet d'appliquer des "défauts intelligents" côté serveur
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

const updateRowSchema = z.object({
  id: z.string().min(1),
  type: z.string().nullable().optional(),
  typeSol: z.string().nullable().optional(),
  retentionEau: z.string().nullable().optional(),
  ilot: z.string().nullable().optional(),
  rotationId: z.string().nullable().optional(),
})

const bulkUpdateSchema = z.object({
  updates: z.array(updateRowSchema).min(1).max(500),
})

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = bulkUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const userId = session!.user.id
  const { updates } = parsed.data

  const ids = updates.map((u) => u.id)
  const owned = await prisma.planche.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  })
  const ownedSet = new Set(owned.map((p) => p.id))
  const refused = ids.filter((id) => !ownedSet.has(id))

  const validUpdates = updates.filter((u) => ownedSet.has(u.id))

  const results = await prisma.$transaction(
    validUpdates.map((u) => {
      const { id, ...fields } = u
      const data: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) data[k] = v
      }
      return prisma.planche.update({
        where: { id },
        data,
        select: { id: true, nom: true },
      })
    })
  )

  return NextResponse.json({
    updated: results.length,
    refused: refused.length,
    refusedIds: refused,
  })
}
