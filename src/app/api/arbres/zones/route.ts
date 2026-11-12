/**
 * API Routes pour les Zones de verger
 * GET /api/arbres/zones - Liste des zones avec count arbres
 */
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const zones = await prisma.zoneVerger.findMany({
      where: { userId: session!.user.id },
      include: {
        _count: { select: { arbres: true } },
      },
      orderBy: { nom: "asc" },
    })

    return NextResponse.json(zones)
  } catch (err) {
    console.error("GET /api/arbres/zones error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération des zones" }, { status: 500 })
  }
}
