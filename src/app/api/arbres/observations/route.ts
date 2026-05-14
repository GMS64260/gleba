/**
 * API Routes pour les Observations de santé des arbres
 * GET /api/arbres/observations - Liste des observations (filtrable)
 * POST /api/arbres/observations - Créer une observation
 */
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams
    const arbreId = searchParams.get("arbreId")
    const type = searchParams.get("type")
    const gravite = searchParams.get("gravite")
    const resolu = searchParams.get("resolu")

    const where: Record<string, unknown> = { userId }
    if (arbreId) where.arbreId = parseInt(arbreId)
    if (type && type !== "all") where.type = type
    if (gravite && gravite !== "all") where.gravite = gravite
    if (resolu !== null && resolu !== "all") {
      if (resolu === "true") where.resolu = true
      if (resolu === "false") where.resolu = false
    }

    const observations = await prisma.observationSante.findMany({
      where,
      include: {
        arbre: {
          select: { id: true, nom: true, type: true, espece: true },
        },
      },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(observations)
  } catch (err) {
    console.error("GET /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la récupération des observations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    if (!body.arbreId) {
      return NextResponse.json({ error: "L'arbre est requis" }, { status: 400 })
    }
    if (!body.type) {
      return NextResponse.json({ error: "Le type d'observation est requis" }, { status: 400 })
    }

    // Vérifier que l'arbre appartient à l'utilisateur
    const arbre = await prisma.arbre.findFirst({
      where: { id: parseInt(body.arbreId), userId: session!.user.id },
    })
    if (!arbre) {
      return NextResponse.json({ error: "Arbre non trouvé" }, { status: 404 })
    }

    const observation = await prisma.observationSante.create({
      data: {
        userId: session!.user.id,
        arbreId: parseInt(body.arbreId),
        date: body.date ? new Date(body.date) : new Date(),
        type: body.type,
        symptome: body.symptome || null,
        diagnostic: body.diagnostic || null,
        gravite: body.gravite || "faible",
        organe: body.organe || null,
        traitement: body.traitement || null,
        methodeTraitement: body.methodeTraitement || null,
        produit: body.produit || null,
        doseAppliquee: body.doseAppliquee ? parseFloat(body.doseAppliquee) : null,
        uniteDose: body.uniteDose || null,
        dar: body.dar ? parseInt(body.dar) : null,
        numAMM: body.numAMM || null,
        resolu: body.resolu || false,
        dateResolution: body.dateResolution ? new Date(body.dateResolution) : null,
        notes: body.notes || null,
      },
      include: {
        arbre: {
          select: { id: true, nom: true, type: true },
        },
      },
    })

    return NextResponse.json(observation, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/observations error:", err)
    return NextResponse.json({ error: "Erreur lors de la création de l'observation" }, { status: 500 })
  }
}
