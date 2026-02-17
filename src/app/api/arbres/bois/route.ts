/**
 * API Production Bois
 * GET /api/arbres/bois - Liste des productions
 * POST /api/arbres/bois - Créer une production
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

// Types de production bois
export const TYPES_PRODUCTION_BOIS = [
  { value: "elagage", label: "Élagage" },
  { value: "abattage", label: "Abattage" },
  { value: "branchage", label: "Branchage" },
]

// Destinations du bois
export const DESTINATIONS_BOIS = [
  { value: "chauffage", label: "Bois de chauffage" },
  { value: "BRF", label: "BRF / Paillage" },
  { value: "vente", label: "Vente" },
  { value: "construction", label: "Construction" },
]

// GET /api/arbres/bois
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams

    // Filtres
    const arbreId = searchParams.get("arbreId")
    const year = searchParams.get("year")
    const type = searchParams.get("type")
    const destination = searchParams.get("destination")

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

    if (type) {
      where.type = type
    }

    if (destination) {
      where.destination = destination
    }

    const productions = await prisma.productionBois.findMany({
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

    return NextResponse.json(productions)
  } catch (err) {
    console.error("GET /api/arbres/bois error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des productions de bois" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/bois
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const body = await request.json()

    // Validation
    if (!body.type) {
      return NextResponse.json(
        { error: "Le type de production est requis" },
        { status: 400 }
      )
    }

    // Vérifier que l'arbre appartient à l'utilisateur (si spécifié)
    if (body.arbreId) {
      const arbre = await prisma.arbre.findFirst({
        where: { id: body.arbreId, userId },
      })

      if (!arbre) {
        return NextResponse.json(
          { error: "Arbre non trouvé" },
          { status: 404 }
        )
      }
    }

    const production = await prisma.productionBois.create({
      data: {
        userId,
        arbreId: body.arbreId || null,
        date: body.date ? new Date(body.date) : new Date(),
        type: body.type,
        volumeM3: body.volumeM3 || null,
        poidsKg: body.poidsKg || null,
        destination: body.destination || null,
        prixVente: body.prixVente || null,
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

    return NextResponse.json(production, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/bois error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de la production de bois" },
      { status: 500 }
    )
  }
}
