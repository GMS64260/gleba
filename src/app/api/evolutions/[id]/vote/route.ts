/**
 * API Community Voice — vote (toggle) sur une demande d'évolution
 * POST /api/evolutions/[id]/vote   (authentifié)
 * Bascule : si l'utilisateur a déjà voté, retire le vote ; sinon l'ajoute.
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  const { id } = await params
  const userId = session!.user.id

  const evolution = await prisma.evolution.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!evolution) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
  }

  const existing = await prisma.evolutionVote.findUnique({
    where: { evolutionId_userId: { evolutionId: id, userId } },
    select: { id: true },
  })

  let hasVoted: boolean
  if (existing) {
    await prisma.evolutionVote.delete({ where: { id: existing.id } })
    hasVoted = false
  } else {
    await prisma.evolutionVote.create({ data: { evolutionId: id, userId } })
    hasVoted = true
  }

  const votes = await prisma.evolutionVote.count({ where: { evolutionId: id } })

  return NextResponse.json({ success: true, hasVoted, votes })
}
