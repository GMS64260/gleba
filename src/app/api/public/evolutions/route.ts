/**
 * API publique (lecture seule) — Community Voice
 * GET /api/public/evolutions
 * Accessible sans authentification : sert la vue anonyme de la roadmap
 * communautaire. Ne renvoie aucune donnée propre à un utilisateur
 * (pas de hasVoted, pas d'identité d'auteur exploitable).
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const evolutions = await prisma.evolution.findMany({
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { votes: true } },
    },
    orderBy: [{ votes: { _count: "desc" } }, { createdAt: "desc" }],
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
    hasVoted: false,
    author: {
      id: "",
      name: e.user.name || e.user.email.split("@")[0],
      isMe: false,
    },
  }))

  return NextResponse.json({ evolutions: data })
}
