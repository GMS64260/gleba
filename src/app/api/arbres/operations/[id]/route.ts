/**
 * API Opération Arbre individuelle
 * GET - Détail d'une opération
 * PUT - Mise à jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { createDepenseFromOperationArbre, deleteAutoEntry } from "@/lib/auto-compta"

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
        cout: body.cout !== undefined ? (body.cout != null ? parseFloat(body.cout) : null) : undefined,
        datePrevue: body.datePrevue !== undefined ? (body.datePrevue ? new Date(body.datePrevue) : null) : undefined,
        fait: body.fait,
        notes: body.notes,
        dureeMinutes: body.dureeMinutes !== undefined ? (body.dureeMinutes ? parseInt(body.dureeMinutes) : null) : undefined,
        nbPersonnes: body.nbPersonnes !== undefined ? (body.nbPersonnes ? parseInt(body.nbPersonnes) : null) : undefined,
        recurrence: body.recurrence !== undefined ? (body.recurrence || null) : undefined,
        saisonRecommandee: body.saisonRecommandee !== undefined ? (body.saisonRecommandee || null) : undefined,
        // DEV3 #6 — champs acceptés par le POST mais absents du PUT jusqu'ici
        tempsHeures: body.tempsHeures !== undefined ? (body.tempsHeures != null ? parseFloat(body.tempsHeures) : null) : undefined,
        temperatureC: body.temperatureC !== undefined ? (body.temperatureC != null ? parseFloat(body.temperatureC) : null) : undefined,
        ventKmh: body.ventKmh !== undefined ? (body.ventKmh != null ? parseFloat(body.ventKmh) : null) : undefined,
        hygrometriePct: body.hygrometriePct !== undefined ? (body.hygrometriePct != null ? parseInt(body.hygrometriePct) : null) : undefined,
        pluie24h: body.pluie24h !== undefined ? (body.pluie24h != null ? Boolean(body.pluie24h) : null) : undefined,
        pluie24hMm: body.pluie24hMm !== undefined ? (body.pluie24hMm != null ? parseFloat(body.pluie24hMm) : null) : undefined,
        materiel: Array.isArray(body.materiel) ? body.materiel : undefined,
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

    // Auto-comptabilite : resynchroniser la depense auto avec les valeurs finales
    // (le helper supprime l'ecriture si cout devient null/0)
    try {
      await createDepenseFromOperationArbre(session!.user.id, {
        id: operation.id,
        type: operation.type,
        description: operation.description,
        cout: operation.cout,
        date: operation.date,
        fait: operation.fait,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (operation_arbre PUT):', autoComptaError)
    }

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

    // Supprimer les ecritures auto-compta liees
    try {
      await deleteAutoEntry('operation_arbre', operationId, 'depense')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (operation_arbre):', autoComptaError)
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
