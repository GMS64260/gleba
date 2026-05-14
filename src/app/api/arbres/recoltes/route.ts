/**
 * API Récoltes Arbres (avec gestion statut stock/vente)
 * GET /api/arbres/recoltes - Liste des recoltes avec filtre statut
 * POST /api/arbres/recoltes - Créer une recolte (statut en_stock par défaut)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { snapshotStatutBio } from "@/lib/statut-bio"
import { genererNumeroLot } from "@/lib/recolte/lot"

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
        lte: new Date(yearNum, 11, 31),
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

    return NextResponse.json(recoltes)
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
    const userId = session!.user.id
    const body = await request.json()

    // Validation
    if (!body.arbreId) {
      return NextResponse.json(
        { error: "L'arbre est requis" },
        { status: 400 }
      )
    }

    if (body.quantite === undefined || body.quantite < 0) {
      return NextResponse.json(
        { error: "La quantité doit être positive" },
        { status: 400 }
      )
    }

    // Vérifier que l'arbre appartient à l'utilisateur.
    // PROMPT 12 — on charge la zone et la parcelle pour snapshoter le statut Bio.
    // DEV3 #4 — on charge aussi parcelleGeo.nom pour le N° de lot.
    const arbre = await prisma.arbre.findFirst({
      where: { id: body.arbreId, userId },
      include: {
        zone: { select: { statutBio: true, dateDebutConversion: true } },
        parcelleGeo: { select: { id: true, nom: true, statutBio: true, dateDebutConversion: true } },
      },
    })

    if (!arbre) {
      return NextResponse.json(
        { error: "Arbre non trouvé" },
        { status: 404 }
      )
    }

    // Statut Bio : priorité à la zone verger, sinon parcelle géo.
    const sourceBio = arbre.zone ?? arbre.parcelleGeo
    const dateRecolte = body.date ? new Date(body.date) : new Date()
    // DEV3 #4 — statut Bio surchargeable depuis le formulaire (auto-rempli
    // depuis la parcelle d'origine par défaut).
    const statutBioSnapshot =
      body.statutBioSnapshot ||
      (sourceBio
        ? snapshotStatutBio(sourceBio.statutBio, sourceBio.dateDebutConversion, dateRecolte)
        : null)

    // DEV3 #4 — parcelle d'origine : par défaut celle de l'arbre, surchargeable
    const parcelleId = body.parcelleId !== undefined ? body.parcelleId : arbre.parcelleGeo?.id ?? null

    // DEV3 #4 — Numéro de lot auto YYYYMMDD-PARCELLE-ESPECE-NN si non fourni.
    // Pour le séquentiel NN, on compte le nb de lots du jour + même parcelle + même espèce.
    let numLot = body.numLot || null
    if (!numLot) {
      const parcelleNom = parcelleId
        ? (await prisma.parcelleGeo.findUnique({ where: { id: parcelleId }, select: { nom: true } }))?.nom
        : null
      const dayStart = new Date(dateRecolte)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(dateRecolte)
      dayEnd.setHours(23, 59, 59, 999)
      const sameDayCount = await prisma.recolteArbre.count({
        where: {
          userId,
          date: { gte: dayStart, lte: dayEnd },
          ...(parcelleId ? { parcelleId } : {}),
          arbre: { espece: arbre.espece },
        },
      })
      numLot = genererNumeroLot({
        date: dateRecolte,
        parcelleNom: parcelleNom ?? null,
        espece: arbre.espece,
        numeroSequence: sameDayCount + 1,
      })
    }

    const recolte = await prisma.recolteArbre.create({
      data: {
        userId,
        arbreId: body.arbreId,
        date: dateRecolte,
        quantite: body.quantite,
        qualite: body.qualite || null,
        prixKg: body.prixKg || null,
        statut: "en_stock",
        datePeremption: body.datePeremption ? new Date(body.datePeremption) : null,
        notes: body.notes || null,
        statutBioSnapshot,
        // DEV3 #4
        parcelleId,
        numLot,
        categorieCommerciale: body.categorieCommerciale || null,
        destinationCommerce: body.destinationCommerce || null,
        conditionnement: body.conditionnement || null,
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

    return NextResponse.json(recolte, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/recoltes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la création de la récolte" },
      { status: 500 }
    )
  }
}
