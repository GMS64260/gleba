/**
 * API Community Voice — gestion d'une demande d'évolution
 * PATCH  /api/evolutions/[id]   (admin : statut / note → roadmap)
 * DELETE /api/evolutions/[id]   (auteur ou admin)
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { evolutionUpdateSchema } from "@/lib/validations/evolution"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  // Seul un admin peut faire évoluer le statut (roadmap)
  if (session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 })
  }

  const { id } = await params

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }

  const parsed = evolutionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    )
  }

  const data: Prisma.EvolutionUpdateInput = {}
  if (parsed.data.statut !== undefined) data.statut = parsed.data.statut
  if (parsed.data.adminNote !== undefined) data.adminNote = parsed.data.adminNote

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 })
  }

  try {
    await prisma.evolution.update({ where: { id }, data })
  } catch {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  const { id } = await params

  const evolution = await prisma.evolution.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!evolution) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 })
  }

  const isAdmin = session!.user.role === "ADMIN"
  const isAuthor = evolution.userId === session!.user.id
  if (!isAdmin && !isAuthor) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 })
  }

  await prisma.evolution.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
