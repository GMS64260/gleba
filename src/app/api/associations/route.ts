/**
 * API Associations de plantes
 * GET /api/associations - Liste des associations
 * POST /api/associations - Créer une association
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { createAssociationSchema } from "@/lib/validations/association"

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const especeId = searchParams.get("especeId")
    const familleId = searchParams.get("familleId")

    const where: any = {}

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    if (especeId || familleId) {
      where.details = {
        some: {
          OR: [
            especeId ? { especeId } : {},
            familleId ? { familleId } : {},
          ].filter(obj => Object.keys(obj).length > 0),
        },
      }
    }

    const associations = await prisma.association.findMany({
      where,
      include: {
        details: {
          include: {
            espece: { select: { id: true, couleur: true } },
            famille: { select: { id: true, couleur: true } },
          },
        },
      },
      orderBy: { nom: "asc" },
    })

    return NextResponse.json(associations)
  } catch (err) {
    console.error("GET /api/associations error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des associations" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const validated = createAssociationSchema.parse(body)

    const { details, ...associationData } = validated

    const association = await prisma.association.create({
      data: {
        ...associationData,
        details: details
          ? {
              create: details.map((d) => ({
                especeId: d.especeId || null,
                familleId: d.familleId || null,
                groupe: d.groupe || null,
                requise: d.requise || false,
                notes: d.notes || null,
              })),
            }
          : undefined,
      },
      include: {
        details: {
          include: {
            espece: { select: { id: true, couleur: true } },
            famille: { select: { id: true, couleur: true } },
          },
        },
      },
    })

    return NextResponse.json(association, { status: 201 })
  } catch (err: any) {
    console.error("POST /api/associations error:", err)

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
      { error: "Erreur lors de la création de l'association" },
      { status: 500 }
    )
  }
}
