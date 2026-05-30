/**
 * API Community Voice — demandes d'évolution
 * GET  /api/evolutions?statut=&categorie=&tri=votes|recent
 * POST /api/evolutions   (créer une demande — authentifié)
 */

import { NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import { evolutionSchema, EVOLUTION_STATUTS, EVOLUTION_CATEGORIES } from "@/lib/validations/evolution"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  const url = new URL(request.url)
  const statut = url.searchParams.get("statut")
  const categorie = url.searchParams.get("categorie")
  const tri = url.searchParams.get("tri") || "votes"

  const where: Prisma.EvolutionWhereInput = {}
  if (statut && (EVOLUTION_STATUTS as readonly string[]).includes(statut)) {
    where.statut = statut as Prisma.EvolutionWhereInput["statut"]
  }
  if (categorie && (EVOLUTION_CATEGORIES as readonly string[]).includes(categorie)) {
    where.categorie = categorie as Prisma.EvolutionWhereInput["categorie"]
  }

  const evolutions = await prisma.evolution.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { votes: true } },
      votes: { where: { userId: session!.user.id }, select: { id: true } },
    },
    orderBy:
      tri === "recent"
        ? [{ createdAt: "desc" }]
        : [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
    take: 500,
  })

  const data = evolutions.map((e) => ({
    id: e.id,
    titre: e.titre,
    description: e.description,
    categorie: e.categorie,
    statut: e.statut,
    adminNote: e.adminNote,
    createdAt: e.createdAt.toISOString(),
    votes: e._count.votes,
    hasVoted: e.votes.length > 0,
    author: {
      id: e.user.id,
      name: e.user.name || e.user.email.split("@")[0],
      isMe: e.user.id === session!.user.id,
    },
  }))

  return NextResponse.json({ evolutions: data })
}

export async function POST(request: Request) {
  const { error, session } = await requireAuthApi(request)
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 })
  }

  const parsed = evolutionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    )
  }

  const { titre, description, categorie } = parsed.data

  const evolution = await prisma.evolution.create({
    data: {
      userId: session!.user.id,
      titre,
      description,
      categorie,
      // L'auteur vote automatiquement pour sa propre demande
      votes: { create: { userId: session!.user.id } },
    },
    select: { id: true },
  })

  return NextResponse.json({ success: true, id: evolution.id }, { status: 201 })
}
