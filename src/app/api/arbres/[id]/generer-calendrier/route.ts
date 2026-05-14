/**
 * POST /api/arbres/:id/generer-calendrier
 * Génère automatiquement les opérations d'entretien pour un arbre
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { findTreeCareProfile, generateCareOperations } from "@/lib/tree-care-calendar"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const arbre = await prisma.arbre.findFirst({
      where: { id: arbreId, userId: session!.user.id },
    })

    if (!arbre) {
      return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })
    }

    if (!arbre.espece) {
      return NextResponse.json(
        { error: "L'arbre n'a pas d'espèce renseignée" },
        { status: 400 }
      )
    }

    const profile = findTreeCareProfile(arbre.espece)
    if (!profile) {
      return NextResponse.json(
        { error: `Aucun calendrier d'entretien connu pour "${arbre.espece}"` },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const year = body.year || new Date().getFullYear()

    // Supprimer les anciennes opérations auto-générées pour cette annee
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    await prisma.operationArbre.deleteMany({
      where: {
        arbreId,
        userId: session!.user.id,
        notes: "auto:calendrier",
        datePrevue: { gte: startOfYear, lte: endOfYear },
      },
    })

    // Créer les nouvelles opérations
    const operations = generateCareOperations(profile, year, arbreId, session!.user.id)
    await prisma.operationArbre.createMany({ data: operations })

    return NextResponse.json({
      count: operations.length,
      espece: profile.espece,
      year,
      operations,
    })
  } catch (err) {
    console.error("POST /api/arbres/[id]/generer-calendrier error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la génération du calendrier" },
      { status: 500 }
    )
  }
}
