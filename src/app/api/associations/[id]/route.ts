/**
 * API Association individuelle
 * GET /api/associations/[id] - Détail d'une association
 * PUT /api/associations/[id] - Modifier une association
 * DELETE /api/associations/[id] - Supprimer une association
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { updateAssociationSchema } from "@/lib/validations/association"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    const association = await prisma.association.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            espece: { select: { id: true, couleur: true, familleId: true } },
            famille: { select: { id: true, couleur: true } },
          },
        },
      },
    })

    if (!association) {
      return NextResponse.json(
        { error: "Association non trouvée" },
        { status: 404 }
      )
    }

    return NextResponse.json(association)
  } catch (err) {
    console.error("GET /api/associations/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'association" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const validated = updateAssociationSchema.parse(body)

    const { details, ...associationData } = validated

    // Vérifier que l'association existe
    const existing = await prisma.association.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Association non trouvée" },
        { status: 404 }
      )
    }

    // Mettre à jour l'association et ses détails
    const association = await prisma.$transaction(async (tx) => {
      // Mettre à jour les données de base
      await tx.association.update({
        where: { id },
        data: associationData,
      })

      // Si des détails sont fournis, les remplacer
      if (details !== undefined) {
        // Supprimer les anciens détails
        await tx.associationDetail.deleteMany({
          where: { associationId: id },
        })

        // Créer les nouveaux détails
        if (details.length > 0) {
          await tx.associationDetail.createMany({
            data: details.map((d) => ({
              associationId: id,
              especeId: d.especeId || null,
              familleId: d.familleId || null,
              groupe: d.groupe || null,
              requise: d.requise || false,
              notes: d.notes || null,
            })),
          })
        }
      }

      // Retourner l'association mise à jour
      return tx.association.findUnique({
        where: { id },
        include: {
          details: {
            include: {
              espece: { select: { id: true, couleur: true } },
              famille: { select: { id: true, couleur: true } },
            },
          },
        },
      })
    })

    return NextResponse.json(association)
  } catch (err: any) {
    console.error("PUT /api/associations/[id] error:", err)

    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: err.errors },
        { status: 400 }
      )
    }

    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "Une association avec ce nom existe déjà" },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'association" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    // Vérifier que l'association existe
    const existing = await prisma.association.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Association non trouvée" },
        { status: 404 }
      )
    }

    // Supprimer l'association (les détails sont supprimés en cascade)
    await prisma.association.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/associations/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'association" },
      { status: 500 }
    )
  }
}
