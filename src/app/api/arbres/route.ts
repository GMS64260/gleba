/**
 * API Routes pour les Arbres et arbustes
 * GET /api/arbres - Liste des arbres
 * POST /api/arbres - Creer un arbre
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

// Types d'arbres disponibles
export const TYPES_ARBRES = [
  { value: "fruitier", label: "Arbre fruitier", color: "#22c55e" },
  { value: "petit_fruit", label: "Petit fruit", color: "#ef4444" },
  { value: "ornement", label: "Ornement", color: "#a855f7" },
  { value: "haie", label: "Haie", color: "#84cc16" },
]

// GET /api/arbres
export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const arbres = await prisma.arbre.findMany({
      where: { userId: session!.user.id },
      orderBy: { nom: "asc" },
    })

    return NextResponse.json(arbres)
  } catch (err) {
    console.error("GET /api/arbres error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des arbres" },
      { status: 500 }
    )
  }
}

// POST /api/arbres
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation basique
    if (!body.nom?.trim()) {
      return NextResponse.json(
        { error: "Le nom est requis" },
        { status: 400 }
      )
    }

    if (!body.type) {
      return NextResponse.json(
        { error: "Le type est requis" },
        { status: 400 }
      )
    }

    const arbre = await prisma.arbre.create({
      data: {
        userId: session!.user.id,
        nom: body.nom.trim(),
        type: body.type,
        espece: body.espece || null,
        variete: body.variete || null,
        portGreffe: body.portGreffe || null,
        fournisseur: body.fournisseur || null,
        dateAchat: body.dateAchat ? new Date(body.dateAchat) : null,
        prixAchat: body.prixAchat ? parseFloat(body.prixAchat) : null,
        datePlantation: body.datePlantation ? new Date(body.datePlantation) : null,
        age: body.age || null,
        posX: body.posX ?? 0,
        posY: body.posY ?? 0,
        envergure: body.envergure ?? 2,
        hauteur: body.hauteur || null,
        etat: body.etat || null,
        pollinisateur: body.pollinisateur || null,
        couleur: body.couleur || null,
        notes: body.notes || null,
        productif: body.productif !== undefined ? body.productif : true,
        anneeProduction: body.anneeProduction ? parseInt(body.anneeProduction) : null,
        rendementMoyen: body.rendementMoyen ? parseFloat(body.rendementMoyen) : null,
      },
    })

    return NextResponse.json(arbre, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la creation de l'arbre" },
      { status: 500 }
    )
  }
}
