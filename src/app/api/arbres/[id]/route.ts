/**
 * API Arbre individuel
 * GET - Detail d'un arbre
 * PUT - Mise a jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id, 10)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const arbre = await prisma.arbre.findUnique({
      where: {
        id: arbreId,
        userId: session!.user.id,
      },
    })

    if (!arbre) {
      return NextResponse.json({ error: "Arbre non trouve" }, { status: 404 })
    }

    return NextResponse.json(arbre)
  } catch (err) {
    console.error("GET /api/arbres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation de l'arbre" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id, 10)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Verifier propriete
    const existing = await prisma.arbre.findUnique({
      where: {
        id: arbreId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Arbre non trouve" }, { status: 404 })
    }

    const body = await request.json()

    const arbre = await prisma.arbre.update({
      where: { id: arbreId },
      data: {
        nom: body.nom,
        type: body.type,
        espece: body.espece,
        variete: body.variete,
        portGreffe: body.portGreffe,
        fournisseur: body.fournisseur,
        dateAchat: body.dateAchat ? new Date(body.dateAchat) : null,
        prixAchat: body.prixAchat != null ? parseFloat(body.prixAchat) : null,
        datePlantation: body.datePlantation ? new Date(body.datePlantation) : null,
        age: body.age,
        posX: body.posX,
        posY: body.posY,
        envergure: body.envergure,
        hauteur: body.hauteur,
        etat: body.etat,
        pollinisateur: body.pollinisateur,
        couleur: body.couleur,
        notes: body.notes,
        productif: body.productif !== undefined ? body.productif : undefined,
        anneeProduction: body.anneeProduction ? parseInt(body.anneeProduction) : undefined,
        rendementMoyen: body.rendementMoyen ? parseFloat(body.rendementMoyen) : undefined,
        especeId: body.especeId || undefined,
      },
    })

    return NextResponse.json(arbre)
  } catch (err) {
    console.error("PUT /api/arbres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id, 10)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Verifier propriete
    const existing = await prisma.arbre.findUnique({
      where: {
        id: arbreId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Arbre non trouve" }, { status: 404 })
    }

    await prisma.arbre.delete({
      where: { id: arbreId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
