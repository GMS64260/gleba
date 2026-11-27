/**
 * API Community Voice — vote (toggle) sur une demande d'évolution
 * POST /api/evolutions/[id]/vote   (authentifié)
 * Bascule : si l'utilisateur a déjà voté, retire le vote ; sinon l'ajoute.
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { getActeurId } from "@/lib/exploitation/garde-session"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  const { id } = await params
  const userId = getActeurId(session)

  const evolution = await prisma.evolution.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!evolution) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
  }

  // La bascule se fait sous verrou : deux votes presque simultanés créaient
  // tous deux la ligne, et le second répondait 500 (équipe debug, D173).
  const { hasVoted, votes } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:vote-evolution:${id}:${userId}`}))`
    const retire = await tx.evolutionVote.deleteMany({ where: { evolutionId: id, userId } })
    if (retire.count === 0) await tx.evolutionVote.create({ data: { evolutionId: id, userId } })
    return { hasVoted: retire.count === 0, votes: await tx.evolutionVote.count({ where: { evolutionId: id } }) }
  })

  return NextResponse.json({ success: true, hasVoted, votes })
}
