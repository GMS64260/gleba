/**
 * API Routes pour les Campagnes de plantation (replantation forestière, haie, agroforesterie, verger)
 * GET /api/arbres/campagnes - Liste
 * POST /api/arbres/campagnes - Créer (avec génération automatique des etapes types)
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { ETAPES_TYPES, type TypeFormation } from "@/data/essences-forestieres"

// GET /api/arbres/campagnes?statut=...&type=...
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const statut = request.nextUrl.searchParams.get("statut")
    const type = request.nextUrl.searchParams.get("type")
    const where: Record<string, unknown> = { userId: session!.user.id }
    if (statut && statut !== "all") where.statut = statut
    if (type && type !== "all") where.typeFormation = type

    const campagnes = await prisma.campagnePlantation.findMany({
      where,
      include: {
        parcelleGeo: { select: { id: true, nom: true, surface: true } },
        zoneVerger: { select: { id: true, nom: true } },
        espece: { select: { id: true, nomLatin: true } },
        productionBois: { select: { id: true, type: true, date: true, volumeM3: true } },
        _count: {
          select: {
            etapes: true,
            observations: true,
          },
        },
      },
      orderBy: [{ datePlantationPrevue: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json(campagnes)
  } catch (err) {
    console.error("GET /api/arbres/campagnes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des campagnes" },
      { status: 500 }
    )
  }
}

// POST /api/arbres/campagnes
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    if (!body.nom?.trim()) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 })
    }
    if (!body.typeFormation) {
      return NextResponse.json({ error: "Le type de formation est requis" }, { status: 400 })
    }

    // Densité calculée si non fournie mais surface + nombre disponibles
    let densite: number | null = body.densitePlantsParHa ? parseFloat(body.densitePlantsParHa) : null
    if (!densite && body.nombrePlants && body.surfaceHa) {
      const n = parseInt(body.nombrePlants)
      const s = parseFloat(body.surfaceHa)
      if (n > 0 && s > 0) densite = n / s
    }

    const datePrevue = body.datePlantationPrevue ? new Date(body.datePlantationPrevue) : null

    const campagne = await prisma.campagnePlantation.create({
      data: {
        userId: session!.user.id,
        nom: body.nom.trim(),
        typeFormation: body.typeFormation,
        nature: body.nature || "boisement",
        cause: body.cause || null,
        peuplementPrecedent: body.peuplementPrecedent || null,
        essencePrecedente: body.essencePrecedente || null,
        ageAvantCoupe: body.ageAvantCoupe ? parseInt(body.ageAvantCoupe) : null,
        surfacePrecedenteHa: body.surfacePrecedenteHa ? parseFloat(body.surfacePrecedenteHa) : null,
        productionBoisId: body.productionBoisId ? parseInt(body.productionBoisId) : null,
        parcelleGeoId: body.parcelleGeoId || null,
        zoneVergerId: body.zoneVergerId ? parseInt(body.zoneVergerId) : null,
        surfaceHa: body.surfaceHa ? parseFloat(body.surfaceHa) : null,
        especeId: body.especeId || null,
        essenceLibre: body.essenceLibre || null,
        varieteOuProvenance: body.varieteOuProvenance || null,
        nombrePlants: body.nombrePlants ? parseInt(body.nombrePlants) : null,
        densitePlantsParHa: densite,
        ecartementRang: body.ecartementRang ? parseFloat(body.ecartementRang) : null,
        ecartementPlant: body.ecartementPlant ? parseFloat(body.ecartementPlant) : null,
        pepiniere: body.pepiniere || null,
        prixUnitaire: body.prixUnitaire ? parseFloat(body.prixUnitaire) : null,
        budgetPrevu: body.budgetPrevu ? parseFloat(body.budgetPrevu) : null,
        aidesObtenues: body.aidesObtenues || null,
        montantAides: body.montantAides ? parseFloat(body.montantAides) : null,
        statut: body.statut || "planifiee",
        datePlantationPrevue: datePrevue,
        protectionType: body.protectionType || null,
        objectifs: body.objectifs || null,
        notes: body.notes || null,
        // PROMPT 09 — Spécificités verger fruitier (NULL pour les autres types).
        porteGreffeId: body.porteGreffeId || null,
        typePlant: body.typePlant || null,
        conduite: body.conduite || null,
        labelProvenance: body.labelProvenance || null,
      },
    })

    // Génération automatique des etapes types
    if (body.genererEtapes !== false && datePrevue) {
      const etapesTypes = ETAPES_TYPES[body.typeFormation as TypeFormation]
      if (etapesTypes && etapesTypes.length > 0) {
        await prisma.etapeCampagne.createMany({
          data: etapesTypes.map((e, idx) => ({
            userId: session!.user.id,
            campagneId: campagne.id,
            type: e.type,
            ordre: idx,
            description: e.libelle,
            datePrevue: new Date(datePrevue.getTime() + e.offsetJours * 24 * 60 * 60 * 1000),
            fait: false,
          })),
        })
      }
    }

    const result = await prisma.campagnePlantation.findUnique({
      where: { id: campagne.id },
      include: {
        parcelleGeo: { select: { id: true, nom: true } },
        zoneVerger: { select: { id: true, nom: true } },
        espece: { select: { id: true, nomLatin: true } },
        etapes: { orderBy: { ordre: "asc" } },
      },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error("POST /api/arbres/campagnes error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la creation de la campagne" },
      { status: 500 }
    )
  }
}
