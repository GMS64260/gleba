/**
 * API Routes pour les Zones de verger
 * GET /api/arbres/zones - Liste des zones avec count arbres
 * POST /api/arbres/zones - Créer une zone
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    if (!body.nom?.trim()) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
    }

    const zone = await prisma.zoneVerger.create({
      data: {
        userId: session!.user.id,
        nom: body.nom.trim(),
        type: body.type || "verger",
        surface: body.surface ? parseFloat(body.surface) : null,
        exposition: body.exposition || null,
        altitude: body.altitude ? parseInt(body.altitude) : null,
        protectionVent: body.protectionVent || null,
        typeSol: body.typeSol || null,
        irrigation: body.irrigation || null,
        notes: body.notes || null,
      },
    })

    return NextResponse.json(zone, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/zones error:", err)
    return NextResponse.json({ error: "Erreur lors de la création de la zone" }, { status: 500 })
  }
}
