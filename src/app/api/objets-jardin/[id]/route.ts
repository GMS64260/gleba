/**
 * API Objet de jardin individuel
 * PUT - Mise à jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

interface Params {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const objetId = parseInt(id, 10)
    if (isNaN(objetId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Vérifier propriété
    const existing = await prisma.objetJardin.findUnique({
      where: {
        id: objetId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Objet non trouvé" }, { status: 404 })
    }

    const body = await request.json()

    const objet = await prisma.objetJardin.update({
      where: { id: objetId },
      data: {
        nom: body.nom,
        type: body.type,
        largeur: body.largeur,
        longueur: body.longueur,
        posX: body.posX,
        posY: body.posY,
        rotation2D: body.rotation2D,
        couleur: body.couleur,
        notes: body.notes
      }
    })

    return NextResponse.json(objet)
  } catch (error) {
    console.error("Erreur PUT objet-jardin:", error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const objetId = parseInt(id, 10)
    if (isNaN(objetId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Vérifier propriété
    const existing = await prisma.objetJardin.findUnique({
      where: {
        id: objetId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Objet non trouvé" }, { status: 404 })
    }

    await prisma.objetJardin.delete({
      where: { id: objetId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erreur DELETE objet-jardin:", error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
