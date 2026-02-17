/**
 * API Récoltes Arbres (avec gestion statut stock/vente)
 * GET /api/arbres/recoltes - Liste des récoltes avec filtre statut
 * POST /api/arbres/recoltes - Créer une récolte (statut en_stock par défaut)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

// GET /api/arbres/recoltes
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams

    // Filtres
    const arbreId = searchParams.get("arbreId")
    const year = searchParams.get("year")
    const statut = searchParams.get("statut")

    const where: Record<string, unknown> = { userId }

    if (arbreId) {
      where.arbreId = parseInt(arbreId)
    }

    if (year) {
      const yearNum = parseInt(year)
      where.date = {
        gte: new Date(yearNum, 0, 1),
        lte: new Date(yearNum, 11, 31),
      }
    }

    if (statut) {
      where.statut = statut
    }

    const recoltes = await prisma.recolteArbre.findMany({
      where,
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
            espece: true,
          },
        },
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(recoltes)
  } catch (err) {
    console.error("GET /api/arbres/recoltes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des récoltes" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/recoltes
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const body = await request.json()

    // Validation
    if (!body.arbreId) {
      return NextResponse.json(
        { error: "L'arbre est requis" },
        { status: 400 }
      )
    }

    if (body.quantite === undefined || body.quantite < 0) {
      return NextResponse.json(
        { error: "La quantité doit être positive" },
        { status: 400 }
      )
    }

    // Vérifier que l'arbre appartient à l'utilisateur
    const arbre = await prisma.arbre.findFirst({
      where: { id: body.arbreId, userId },
    })

    if (!arbre) {
      return NextResponse.json(
        { error: "Arbre non trouvé" },
        { status: 404 }
      )
    }

    const recolte = await prisma.recolteArbre.create({
      data: {
        userId,
        arbreId: body.arbreId,
        date: body.date ? new Date(body.date) : new Date(),
        quantite: body.quantite,
        qualite: body.qualite || null,
        prixKg: body.prixKg || null,
        statut: "en_stock",
        datePeremption: body.datePeremption ? new Date(body.datePeremption) : null,
        notes: body.notes || null,
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
      },
    })

    return NextResponse.json(recolte, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/recoltes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de la récolte" },
      { status: 500 }
    )
  }
}
