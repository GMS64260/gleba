/**
 * API Production Bois
 * GET /api/arbres/bois - Liste des productions
 * POST /api/arbres/bois - Créer une production
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { genererNumeroLot, m3PleinToStere, stereToM3Plein } from "@/lib/recolte/lot"

// Types de production bois
export const TYPES_PRODUCTION_BOIS = [
  { value: "elagage", label: "Élagage" },
  { value: "abattage", label: "Abattage" },
  { value: "branchage", label: "Branchage" },
]

// DEV3 #4 — Destinations canoniques (audit Marc 2026-05-14)
export const DESTINATIONS_BOIS = [
  { value: "Stock interne", label: "Stock interne" },
  { value: "Vente", label: "Vente" },
  { value: "Auto-consommation", label: "Auto-consommation" },
  { value: "Don", label: "Don" },
]

// DEV3 #4 — Qualités de bois (audit Marc)
export const QUALITES_BOIS = [
  { value: "Bois d'œuvre", label: "Bois d'œuvre" },
  { value: "Bois de chauffage", label: "Bois de chauffage" },
  { value: "BRF", label: "BRF" },
  { value: "Plaquette", label: "Plaquette" },
  { value: "Piquet", label: "Piquet" },
  { value: "Déchet vert", label: "Déchet vert" },
]

// GET /api/arbres/bois
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const searchParams = request.nextUrl.searchParams

    // Filtres
    const arbreId = searchParams.get("arbreId")
    const year = searchParams.get("year")
    const type = searchParams.get("type")
    const destination = searchParams.get("destination")

    const where: Record<string, unknown> = { userId }

    if (arbreId) {
      where.arbreId = parseInt(arbreId)
    }

    if (year) {
      const yearNum = parseInt(year)
      where.date = {
        gte: new Date(yearNum, 0, 1),
        lte: new Date(yearNum, 11, 31),
      }
    }

    if (type) {
      where.type = type
    }

    if (destination) {
      where.destination = destination
    }

    const productions = await prisma.productionBois.findMany({
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

    return NextResponse.json(productions)
  } catch (err) {
    console.error("GET /api/arbres/bois error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des productions de bois" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/bois
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session!.user.id
    const body = await request.json()

    // Validation
    if (!body.type) {
      return NextResponse.json(
        { error: "Le type de production est requis" },
        { status: 400 }
      )
    }

    // Vérifier que l'arbre appartient à l'utilisateur (si spécifié)
    let arbre: { id: number; espece: string | null; parcelleGeoId: string | null } | null = null
    if (body.arbreId) {
      arbre = await prisma.arbre.findFirst({
        where: { id: body.arbreId, userId },
        select: { id: true, espece: true, parcelleGeoId: true },
      })

      if (!arbre) {
        return NextResponse.json(
          { error: "Arbre non trouvé" },
          { status: 404 }
        )
      }
    }

    const dateProd = body.date ? new Date(body.date) : new Date()

    // DEV3 #4 — Conversion automatique stère ↔ m³ plein
    // Si l'utilisateur saisit l'un, on calcule l'autre.
    let volumeM3 = body.volumeM3 != null && body.volumeM3 !== "" ? parseFloat(body.volumeM3) : null
    let volumeStere = body.volumeStere != null && body.volumeStere !== "" ? parseFloat(body.volumeStere) : null
    if (volumeM3 != null && volumeStere == null) volumeStere = m3PleinToStere(volumeM3)
    if (volumeStere != null && volumeM3 == null) volumeM3 = stereToM3Plein(volumeStere)

    // DEV3 #4 — Parcelle d'origine : par défaut celle de l'arbre, surchargeable
    const parcelleId =
      body.parcelleId !== undefined ? body.parcelleId : arbre?.parcelleGeoId ?? null

    // DEV3 #4 — N° de lot auto YYYYMMDD-PARCELLE-ESPECE-NN si non fourni
    let numLot = body.numLot || null
    if (!numLot) {
      const parcelleNom = parcelleId
        ? (await prisma.parcelleGeo.findUnique({ where: { id: parcelleId }, select: { nom: true } }))?.nom
        : null
      const dayStart = new Date(dateProd)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dateProd)
      dayEnd.setHours(23, 59, 59, 999)
      const sameDayCount = await prisma.productionBois.count({
        where: {
          userId,
          date: { gte: dayStart, lte: dayEnd },
          ...(parcelleId ? { parcelleId } : {}),
        },
      })
      numLot = genererNumeroLot({
        date: dateProd,
        parcelleNom: parcelleNom ?? null,
        espece: arbre?.espece ?? body.type,
        numeroSequence: sameDayCount + 1,
      })
    }

    const production = await prisma.productionBois.create({
      data: {
        userId,
        arbreId: body.arbreId || null,
        date: dateProd,
        type: body.type,
        volumeM3,
        volumeStere,
        poidsKg: body.poidsKg ? parseFloat(body.poidsKg) : null,
        statut: "en_stock",
        destination: body.destination || null,
        prixVente: body.prixVente ? parseFloat(body.prixVente) : null,
        notes: body.notes || null,
        // DEV3 #4
        parcelleId,
        numLot,
        qualiteBois: body.qualiteBois || null,
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
        parcelle: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json(production, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/bois error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de la production de bois" },
      { status: 500 }
    )
  }
}
