/**
 * Mise à jour en masse des positions/rotations de planches (POSTREVIEW Sprint 7).
 * Consommé par `useGardenLayout` qui buffer les déplacements drag et envoie
 * un seul PUT debouncé à la fin du drag.
 *
 * PUT /api/maraichage/planches/bulk-position
 *   body: { updates: [{ id: string, posX?, posY?, rotation2D? }] }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { z } from "zod"

// Nombre fini, ou chaîne qui en écrit un. `z.coerce.number()` lisait null, ''
// et false comme 0 : la planche partait à l'origine du plan sans erreur.
const coordonnee = z.preprocess(
  (valeur) => (typeof valeur === "string" && valeur.trim() !== "" ? Number(valeur) : valeur),
  z.number().finite()
)

const schema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        posX: coordonnee.optional(),
        posY: coordonnee.optional(),
        rotation2D: coordonnee.optional(),
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

    // Une seule transaction pour atomicité multi-updates
    const results = await prisma.$transaction(
      parsed.data.updates.map((u) => {
        const data: Prisma.PlancheUpdateManyMutationInput = {}
        if (u.posX !== undefined) data.posX = u.posX
        if (u.posY !== undefined) data.posY = u.posY
        if (u.rotation2D !== undefined) data.rotation2D = u.rotation2D
        // updateMany pour scoping userId (id seul ne suffit pas)
        return prisma.planche.updateMany({
          where: { id: u.id, userId },
          data,
        })
      })
    )
    const updated = results.reduce((s, r) => s + r.count, 0)
    return NextResponse.json({ updated })
  } catch (err) {
    console.error("PUT /api/maraichage/planches/bulk-position error:", err)
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 })
  }
}
