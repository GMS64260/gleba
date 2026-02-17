/**
 * API Opération Arbre individuelle
 * GET - Détail d'une opération
 * PUT - Mise à jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/operations/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const operationId = parseInt(id, 10)
    if (isNaN(operationId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const operation = await prisma.operationArbre.findUnique({
      where: {
        id: operationId,
        userId: session!.user.id,
      },
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
    })

    if (!operation) {
      return NextResponse.json({ error: "Opération non trouvée" }, { status: 404 })
    }

    return NextResponse.json(operation)
  } catch (err) {
    console.error("GET /api/arbres/operations/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'opération" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/operations/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const operationId = parseInt(id, 10)
    if (isNaN(operationId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Vérifier propriété
    const existing = await prisma.operationArbre.findUnique({
      where: {
        id: operationId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Opération non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    const operation = await prisma.operationArbre.update({
      where: { id: operationId },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        type: body.type,
        description: body.description,
        produit: body.produit,
        quantite: body.quantite,
        unite: body.unite,
        cout: body.cout,
        datePrevue: body.datePrevue ? new Date(body.datePrevue) : null,
        fait: body.fait,
        notes: body.notes,
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

    return NextResponse.json(operation)
  } catch (err) {
    console.error("PUT /api/arbres/operations/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/operations/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const operationId = parseInt(id, 10)
    if (isNaN(operationId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Vérifier propriété
    const existing = await prisma.operationArbre.findUnique({
      where: {
        id: operationId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Opération non trouvée" }, { status: 404 })
    }

    await prisma.operationArbre.delete({
      where: { id: operationId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/operations/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
