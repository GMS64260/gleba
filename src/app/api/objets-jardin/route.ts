/**
 * API Objets de jardin
 * GET - Liste des objets
 * POST - Création d'un objet
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    // Filtre par parcelle (optionnel)
    const parcelle = request.nextUrl.searchParams.get('parcelle')
    const where: Record<string, unknown> = { userId: session!.user.id }
    if (parcelle && parcelle !== 'all') {
      if (parcelle === 'none') {
        where.parcelleGeoId = null
      } else {
        where.parcelleGeoId = parcelle
      }
    }

    const objets = await prisma.objetJardin.findMany({
      where,
      orderBy: { id: 'asc' }
    })
    return NextResponse.json(objets)
  } catch (error) {
    console.error("Erreur GET objets-jardin:", error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des objets" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    const objet = await prisma.objetJardin.create({
      data: {
        userId: session!.user.id,
        nom: body.nom || null,
        type: body.type,
        largeur: body.largeur,
        longueur: body.longueur,
        posX: body.posX,
        posY: body.posY,
        rotation2D: body.rotation2D || 0,
        couleur: body.couleur || null,
        notes: body.notes || null,
        parcelleGeoId: body.parcelleGeoId || null,
      }
    })

    return NextResponse.json(objet, { status: 201 })
  } catch (error) {
    console.error("Erreur POST objets-jardin:", error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'objet" },
      { status: 500 }
    )
  }
}
