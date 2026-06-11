/**
 * API Campagne individuelle
 * GET - Détail (avec etapes et observations)
 * PUT - Mise à jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { createDepenseFromCampagnePlantation, deleteAutoEntry } from "@/lib/auto-compta"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/campagnes/[id]
export async function GET(_request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const campagneId = parseInt(id, 10)
    if (isNaN(campagneId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const campagne = await prisma.campagnePlantation.findFirst({
      where: { id: campagneId, userId: session!.user.id },
      include: {
        parcelleGeo: { select: { id: true, nom: true, surface: true } },
        zoneVerger: { select: { id: true, nom: true } },
        espece: { select: { id: true, nomLatin: true } },
        productionBois: { include: { arbre: { select: { id: true, nom: true } } } },
        etapes: { orderBy: [{ ordre: "asc" }, { datePrevue: "asc" }] },
        observations: { orderBy: { date: "desc" } },
      },
    })

    if (!campagne) {
      return NextResponse.json({ error: "Campagne non trouvée" }, { status: 404 })
    }

    return NextResponse.json(campagne)
  } catch (err) {
    console.error("GET /api/arbres/campagnes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/campagnes/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const campagneId = parseInt(id, 10)
    if (isNaN(campagneId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.campagnePlantation.findFirst({
      where: { id: campagneId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Campagne non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    const campagne = await prisma.campagnePlantation.update({
      where: { id: campagneId },
      data: {
        nom: body.nom !== undefined ? body.nom : undefined,
        typeFormation: body.typeFormation !== undefined ? body.typeFormation : undefined,
        nature: body.nature !== undefined ? body.nature : undefined,
        cause: body.cause !== undefined ? (body.cause || null) : undefined,
        peuplementPrecedent: body.peuplementPrecedent !== undefined ? (body.peuplementPrecedent || null) : undefined,
        essencePrecedente: body.essencePrecedente !== undefined ? (body.essencePrecedente || null) : undefined,
        ageAvantCoupe: body.ageAvantCoupe !== undefined ? (body.ageAvantCoupe ? parseInt(body.ageAvantCoupe) : null) : undefined,
        surfacePrecedenteHa: body.surfacePrecedenteHa !== undefined ? (body.surfacePrecedenteHa ? parseFloat(body.surfacePrecedenteHa) : null) : undefined,
        productionBoisId: body.productionBoisId !== undefined ? (body.productionBoisId ? parseInt(body.productionBoisId) : null) : undefined,
        parcelleGeoId: body.parcelleGeoId !== undefined ? (body.parcelleGeoId || null) : undefined,
        zoneVergerId: body.zoneVergerId !== undefined ? (body.zoneVergerId ? parseInt(body.zoneVergerId) : null) : undefined,
        surfaceHa: body.surfaceHa !== undefined ? (body.surfaceHa ? parseFloat(body.surfaceHa) : null) : undefined,
        especeId: body.especeId !== undefined ? (body.especeId || null) : undefined,
        essenceLibre: body.essenceLibre !== undefined ? (body.essenceLibre || null) : undefined,
        varieteOuProvenance: body.varieteOuProvenance !== undefined ? (body.varieteOuProvenance || null) : undefined,
        porteGreffeId: body.porteGreffeId !== undefined ? (body.porteGreffeId || null) : undefined,
        typePlant: body.typePlant !== undefined ? (body.typePlant || null) : undefined,
        conduite: body.conduite !== undefined ? (body.conduite || null) : undefined,
        labelProvenance: body.labelProvenance !== undefined ? (body.labelProvenance || null) : undefined,
        nombrePlants: body.nombrePlants !== undefined ? (body.nombrePlants ? parseInt(body.nombrePlants) : null) : undefined,
        densitePlantsParHa: body.densitePlantsParHa !== undefined ? (body.densitePlantsParHa ? parseFloat(body.densitePlantsParHa) : null) : undefined,
        ecartementRang: body.ecartementRang !== undefined ? (body.ecartementRang ? parseFloat(body.ecartementRang) : null) : undefined,
        ecartementPlant: body.ecartementPlant !== undefined ? (body.ecartementPlant ? parseFloat(body.ecartementPlant) : null) : undefined,
        pepiniere: body.pepiniere !== undefined ? (body.pepiniere || null) : undefined,
        prixUnitaire: body.prixUnitaire !== undefined ? (body.prixUnitaire ? parseFloat(body.prixUnitaire) : null) : undefined,
        budgetPrevu: body.budgetPrevu !== undefined ? (body.budgetPrevu ? parseFloat(body.budgetPrevu) : null) : undefined,
        coutReel: body.coutReel !== undefined ? (body.coutReel ? parseFloat(body.coutReel) : null) : undefined,
        aidesObtenues: body.aidesObtenues !== undefined ? (body.aidesObtenues || null) : undefined,
        montantAides: body.montantAides !== undefined ? (body.montantAides ? parseFloat(body.montantAides) : null) : undefined,
        statut: body.statut !== undefined ? body.statut : undefined,
        datePlantationPrevue: body.datePlantationPrevue !== undefined ? (body.datePlantationPrevue ? new Date(body.datePlantationPrevue) : null) : undefined,
        datePlantationReelle: body.datePlantationReelle !== undefined ? (body.datePlantationReelle ? new Date(body.datePlantationReelle) : null) : undefined,
        protectionType: body.protectionType !== undefined ? (body.protectionType || null) : undefined,
        objectifs: body.objectifs !== undefined ? (body.objectifs || null) : undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
      },
      include: {
        parcelleGeo: { select: { id: true, nom: true } },
        zoneVerger: { select: { id: true, nom: true } },
        espece: { select: { id: true, nomLatin: true } },
        etapes: { orderBy: { ordre: "asc" } },
        observations: { orderBy: { date: "desc" } },
      },
    })

    // Auto-comptabilite : resynchroniser la depense auto (coutReel) avec les
    // valeurs finales (le helper supprime l'ecriture si coutReel devient null/0)
    try {
      await createDepenseFromCampagnePlantation(session!.user.id, {
        id: campagne.id,
        nom: campagne.nom,
        coutReel: campagne.coutReel,
        datePlantationReelle: campagne.datePlantationReelle,
        datePlantationPrevue: campagne.datePlantationPrevue,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (campagne_plantation PUT):', autoComptaError)
    }

    return NextResponse.json(campagne)
  } catch (err) {
    console.error("PUT /api/arbres/campagnes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/campagnes/[id]
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const campagneId = parseInt(id, 10)
    if (isNaN(campagneId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.campagnePlantation.findFirst({
      where: { id: campagneId, userId: session!.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: "Campagne non trouvée" }, { status: 404 })
    }

    // Supprimer les ecritures auto-compta liees
    try {
      await deleteAutoEntry('campagne_plantation', campagneId, 'depense')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (campagne_plantation):', autoComptaError)
    }

    await prisma.campagnePlantation.delete({ where: { id: campagneId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/campagnes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
