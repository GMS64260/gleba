/**
 * API Associations de plantes
 * GET /api/associations - Liste des associations
 * POST /api/associations - Créer une association
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { ZodError } from "zod"
import { requireAdminApi, requireAuthApi } from "@/lib/auth-utils"
import { ASSOCIATION_TYPES, createAssociationSchema, type AssociationType } from "@/lib/validations/association"
import { getEspeceAliases } from "@/lib/especes/aliases"
import { INCLUDE_DETAILS, MESSAGE_TROP_PEU_DE_MEMBRES, MESSAGE_REFERENCE_INCONNUE, detailsAEcrire, estReferenceInconnue } from "./details"

function generateAssociationId(nom: string): string {
  return "asso-" + nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search")
    const especeId = searchParams.get("especeId")
    const familleId = searchParams.get("familleId")
    const type = searchParams.get("type")

    const where: Prisma.AssociationWhereInput = {}

    // Filtre additif : un appelant qui veut les seules associations favorables
    // (recommandations) n'a plus à trier lui-même. Valeur inconnue ignorée.
    if (type && (ASSOCIATION_TYPES as readonly string[]).includes(type)) {
      where.type = type as AssociationType
    }

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
            // Alias compris : « Haricot vert » remonte les règles de « Haricot »,
            // comme la fiche espèce et les alertes.
            especeId ? { especeId: { in: getEspeceAliases(especeId), mode: "insensitive" as const } } : {},
            familleId ? { familleId } : {},
          ].filter(obj => Object.keys(obj).length > 0),
        },
      }
    }

    const associations = await prisma.association.findMany({
      where,
      include: INCLUDE_DETAILS,
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
  // Référentiel GLOBAL (pas de `userId`) : une association créée ici s'affiche
  // dans la planification et les alertes d'adjacence de toutes les
  // exploitations. Comme PUT et DELETE (1effeac), la création est réservée à
  // l'administration ; elle était restée ouverte à tout compte (revue du
  // 2026-11-04).
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const body = await request.json()
    const validated = createAssociationSchema.parse(body)

    const { details, ...associationData } = validated
    // Une règle à moins de deux membres ne relie personne : muette partout.
    if (detailsAEcrire(details ?? []).length < 2) {
      return NextResponse.json({ error: MESSAGE_TROP_PEU_DE_MEMBRES }, { status: 400 })
    }
    const id = generateAssociationId(associationData.nom)

    // Audit Marc 2026-05-14 — Bug 19 : `type` est validé par Zod (default
    // "favorable") et passé tel quel à Prisma.
    const association = await prisma.association.create({
      data: {
        id,
        ...associationData,
        details: details ? { create: detailsAEcrire(details) } : undefined,
      },
      include: INCLUDE_DETAILS,
    })

    return NextResponse.json(association, { status: 201 })
  } catch (err) {
    console.error("POST /api/associations error:", err)

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
      { error: "Erreur lors de la création de l'association" },
      { status: 500 }
    )
  }
}
