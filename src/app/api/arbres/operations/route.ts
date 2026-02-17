/**
 * API Opérations Arbres
 * GET /api/arbres/operations - Liste des opérations
 * POST /api/arbres/operations - Créer une opération
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

// Types d'opérations
export const TYPES_OPERATIONS = [
  { value: "taille", label: "Taille" },
  { value: "greffe", label: "Greffe" },
  { value: "traitement", label: "Traitement" },
  { value: "fertilisation", label: "Fertilisation" },
  { value: "autre", label: "Autre" },
]

// GET /api/arbres/operations
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams

    // Filtres
    const arbreId = searchParams.get("arbreId")
    const type = searchParams.get("type")
    const fait = searchParams.get("fait")
    const year = searchParams.get("year")

    const where: Record<string, unknown> = { userId }

    if (arbreId) {
      where.arbreId = parseInt(arbreId)
    }

    if (type) {
      where.type = type
    }

    if (fait !== null && fait !== undefined) {
      where.fait = fait === "true"
    }

    if (year) {
      const yearNum = parseInt(year)
      where.date = {
        gte: new Date(yearNum, 0, 1),
        lte: new Date(yearNum, 11, 31),
      }
    }

    const operations = await prisma.operationArbre.findMany({
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
      orderBy: [
        { fait: "asc" }, // Non faites en premier
        { datePrevue: "asc" },
        { date: "desc" },
      ],
    })

    return NextResponse.json(operations)
  } catch (err) {
    console.error("GET /api/arbres/operations error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des opérations" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/operations
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

    if (!body.type) {
      return NextResponse.json(
        { error: "Le type d'opération est requis" },
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

    const operation = await prisma.operationArbre.create({
      data: {
        userId,
        arbreId: body.arbreId,
        date: body.date ? new Date(body.date) : new Date(),
        type: body.type,
        description: body.description || null,
        produit: body.produit || null,
        quantite: body.quantite || null,
        unite: body.unite || null,
        cout: body.cout || null,
        datePrevue: body.datePrevue ? new Date(body.datePrevue) : null,
        fait: body.fait !== undefined ? body.fait : true,
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

    return NextResponse.json(operation, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/operations error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'opération" },
      { status: 500 }
    )
  }
}
