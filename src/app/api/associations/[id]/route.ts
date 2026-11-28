/**
 * API Association individuelle
 * GET /api/associations/[id] - Détail d'une association
 * PUT /api/associations/[id] - Modifier une association
 * DELETE /api/associations/[id] - Supprimer une association
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { FicheModifieeAilleurs, INCREMENT_VERSION, controlerVersionFiche, lireVersionLue } from "@/lib/api/version-fiche"
import { Prisma } from "@prisma/client"
import { ZodError } from "zod"
import { requireAuthApi, requireAdminApi } from "@/lib/auth-utils"
import { updateAssociationSchema } from "@/lib/validations/association"
import { INCLUDE_DETAILS, MESSAGE_TROP_PEU_DE_MEMBRES, MESSAGE_REFERENCE_INCONNUE, detailsAEcrire, estReferenceInconnue } from "../details"

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
          // Ordre stable : le formulaire renvoie les lignes dans l'ordre reçu.
          orderBy: { id: "asc" },
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
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    // Version de fiche : l'écran renvoie celle qu'il a lue.
    const lecture = lireVersionLue(body)
    if (!lecture.ok) return NextResponse.json({ error: lecture.erreur }, { status: 400 })
    const validated = updateAssociationSchema.parse(body)

    const { details, active, motifDesactivation, ...associationData } = validated

    // Détails renvoyés : au moins deux membres. Sans `details`, la
    // modification ne touche pas aux lignes existantes (données anciennes).
    if (details !== undefined && detailsAEcrire(details).length < 2) {
      return NextResponse.json({ error: MESSAGE_TROP_PEU_DE_MEMBRES }, { status: 400 })
    }

    // Vérifier que l'association existe
    const existing = await prisma.association.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: "Association non trouvée" },
        { status: 404 }
      )
    }

    // Mettre à jour l'association et ses details
    const association = await prisma.$transaction(async (tx) => {
      await controlerVersionFiche(tx, 'associations', id, lecture.version, 'Association')
      // Mettre à jour les données de base
      // Désactivation / réactivation : la règle et ses détails sont conservés.
      // Une règle déjà désactivée garde sa date d'origine.
      const etat =
        active === true
          ? { desactiveeLe: null, motifDesactivation: null }
          : active === false
            ? {
                desactiveeLe: existing.desactiveeLe ?? new Date(),
                ...(motifDesactivation !== undefined ? { motifDesactivation } : {}),
              }
            : {}
      await tx.association.update({
        where: { id },
        data: { ...associationData, ...etat, ...INCREMENT_VERSION },
      })

      // Si des details sont fournis, les remplacer
      if (details !== undefined) {
        // Supprimer les anciens details
        await tx.associationDetail.deleteMany({
          where: { associationId: id },
        })

        // Créer les nouveaux details
        const lignes = detailsAEcrire(details)
        if (lignes.length > 0) {
          await tx.associationDetail.createMany({
            data: lignes.map((d) => ({ associationId: id, ...d })),
          })
        }
      }

      // Retourner l'association mise à jour
      return tx.association.findUnique({
        where: { id },
        include: INCLUDE_DETAILS,
      })
    })

    return NextResponse.json(association)
  } catch (err) {
    if (err instanceof FicheModifieeAilleurs) return err.reponse()
    console.error("PUT /api/associations/[id] error:", err)

    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: err.issues },
        { status: 400 }
      )
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Une association avec ce nom existe déjà" },
        { status: 409 }
      )
    }

    if (estReferenceInconnue(err)) {
      return NextResponse.json({ error: MESSAGE_REFERENCE_INCONNUE }, { status: 400 })
    }

    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'association" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminApi()
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

    // Supprimer l'association (les details sont supprimés en cascade)
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
