/**
 * API Récoltes Arbres (avec gestion statut stock/vente)
 * GET /api/arbres/recoltes - Liste des recoltes avec filtre statut
 * POST /api/arbres/recoltes - Créer une recolte (statut en_stock par défaut)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { creerRecolteFruit } from "@/lib/verger/creation-recolte"
import { ErreurVerger } from "@/lib/verger/erreur"
import { chargerAvertissementsDarFruits } from "@/lib/verger/dar"
import { chargerSuiviDesLignes } from "@/lib/comptabilite/suivi-ecriture"

// GET /api/arbres/recoltes
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams

    // Filtres
    const arbreId = searchParams.get("arbreId")
    const year = searchParams.get("year")
    const statut = searchParams.get("statut")

    const where: Record<string, unknown> = { userId }

    if (arbreId) {
      where.arbreId = parseInt(arbreId)
    }

    if (year) {
      const yearNum = parseInt(year)
      where.date = {
        gte: new Date(yearNum, 0, 1),
        lt: new Date(yearNum + 1, 0, 1),
      }
    }

    if (statut) {
      where.statut = statut
    }

    const recoltes = await prisma.recolteArbre.findMany({
      where,
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
            espece: true,
          },
        },
      },
      orderBy: { date: "desc" },
    })

    const warnings = await chargerAvertissementsDarFruits(prisma, userId, recoltes)
    const suivi = await chargerSuiviDesLignes(userId, recoltes.filter(r => r.statut === 'vendu').map(r => ({ id: String(r.id), source: 'RecolteArbre', sourceId: r.id, factureId: r.factureId })))
    return NextResponse.json(recoltes.map(r => ({ ...r, warnings: warnings.get(r.id), ecriture: suivi.get(String(r.id))?.ecriture })))
  } catch (err) {
    console.error("GET /api/arbres/recoltes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des récoltes" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/recoltes
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    return NextResponse.json(await creerRecolteFruit(session!.user.id, await request.json()), { status: 201 })
  } catch (err) {
    if (err instanceof ErreurVerger) return NextResponse.json({ error: err.message, champ: err.champ }, { status: err.status })
    console.error("POST /api/arbres/recoltes error:", err)
    return NextResponse.json({ error: "Erreur lors de la création de la récolte" }, { status: 500 })
  }
}
