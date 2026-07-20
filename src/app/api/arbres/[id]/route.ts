/**
 * API Arbre individuel
 * GET - Detail d'un arbre
 * PUT - Mise a jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id, 10)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Feedback Marc 2026-05-16 — V4 Bug 1 : on expose le _count des
    // dépendances supprimées en cascade (récoltes, opérations,
    // observations) pour que la fiche puisse alerter l'utilisateur
    // avant de cliquer sur Supprimer.
    const arbre = await prisma.arbre.findUnique({
      where: {
        id: arbreId,
        userId: session!.user.id,
      },
      include: {
        _count: {
          select: {
            recoltesArbres: true,
            operationsArbres: true,
            observationsSante: true,
          },
        },
      },
    })

    if (!arbre) {
      return NextResponse.json({ error: "Arbre non trouve" }, { status: 404 })
    }

    return NextResponse.json(arbre)
  } catch (err) {
    console.error("GET /api/arbres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation de l'arbre" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id, 10)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Verifier propriete
    const existing = await prisma.arbre.findUnique({
      where: {
        id: arbreId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Arbre non trouve" }, { status: 404 })
    }

    const body = await request.json()

    // Isolation multi-tenant : la zone / parcelle référencée doit appartenir à l'utilisateur
    if (body.zoneId) {
      const zoneId = parseInt(body.zoneId)
      const zone = isNaN(zoneId)
        ? null
        : await prisma.zoneVerger.findFirst({
            where: { id: zoneId, userId: session!.user.id },
          })
      if (!zone) {
        return NextResponse.json({ error: "Zone non trouvée" }, { status: 404 })
      }
    }
    if (body.parcelleGeoId) {
      const parcelle = await prisma.parcelleGeo.findFirst({
        where: { id: body.parcelleGeoId, userId: session!.user.id },
      })
      if (!parcelle) {
        return NextResponse.json({ error: "Parcelle non trouvée" }, { status: 404 })
      }
    }

    const arbre = await prisma.arbre.update({
      where: { id: arbreId },
      data: {
        nom: body.nom,
        type: body.type,
        espece: body.espece,
        variete: body.variete,
        portGreffe: body.portGreffe,
        // Bug #1 — Le PUT ignorait porte-greffe structuré + circonférence + GPS,
        // d'où le bug "fiche détail vide" alors que la création persistait bien.
        porteGreffeId: body.porteGreffeId !== undefined ? (body.porteGreffeId || null) : undefined,
        circonferenceCm: body.circonferenceCm !== undefined
          ? (body.circonferenceCm != null ? parseFloat(body.circonferenceCm) : null)
          : undefined,
        gpsLat: body.gpsLat !== undefined
          ? (body.gpsLat != null ? parseFloat(body.gpsLat) : null)
          : undefined,
        gpsLng: body.gpsLng !== undefined
          ? (body.gpsLng != null ? parseFloat(body.gpsLng) : null)
          : undefined,
        fournisseur: body.fournisseur,
        dateAchat: body.dateAchat !== undefined ? (body.dateAchat ? new Date(body.dateAchat) : null) : undefined,
        prixAchat: body.prixAchat !== undefined
          ? (body.prixAchat != null && body.prixAchat !== "" ? parseFloat(body.prixAchat) : null)
          : undefined,
        datePlantation: body.datePlantation !== undefined ? (body.datePlantation ? new Date(body.datePlantation) : null) : undefined,
        age: body.age,
        posX: body.posX,
        posY: body.posY,
        envergure: body.envergure,
        envergureAdulte: body.envergureAdulte !== undefined
          ? (body.envergureAdulte != null && body.envergureAdulte !== "" ? parseFloat(body.envergureAdulte) : null)
          : undefined,
        hauteur: body.hauteur,
        etat: body.etat,
        pollinisateur: body.pollinisateur,
        couleur: body.couleur,
        notes: body.notes,
        productif: body.productif !== undefined ? body.productif : undefined,
        anneeProduction: body.anneeProduction !== undefined
          ? (body.anneeProduction != null && body.anneeProduction !== "" ? parseInt(body.anneeProduction) : null)
          : undefined,
        rendementMoyen: body.rendementMoyen !== undefined
          ? (body.rendementMoyen != null && body.rendementMoyen !== "" ? parseFloat(body.rendementMoyen) : null)
          : undefined,
        especeId: body.especeId || undefined,
        // Champs verger enrichis
        formeTaille: body.formeTaille !== undefined ? (body.formeTaille || null) : undefined,
        vigueur: body.vigueur !== undefined ? (body.vigueur || null) : undefined,
        distancePlantation: body.distancePlantation !== undefined ? (body.distancePlantation ? parseFloat(body.distancePlantation) : null) : undefined,
        distanceRang: body.distanceRang !== undefined ? (body.distanceRang ? parseFloat(body.distanceRang) : null) : undefined,
        orientationRang: body.orientationRang !== undefined ? (body.orientationRang || null) : undefined,
        dateGreffe: body.dateGreffe !== undefined ? (body.dateGreffe ? new Date(body.dateGreffe) : null) : undefined,
        typeGreffe: body.typeGreffe !== undefined ? (body.typeGreffe || null) : undefined,
        heuresFroidRequis: body.heuresFroidRequis !== undefined ? (body.heuresFroidRequis ? parseInt(body.heuresFroidRequis) : null) : undefined,
        floraison: body.floraison !== undefined ? (body.floraison || null) : undefined,
        groupePollinisation: body.groupePollinisation !== undefined ? (body.groupePollinisation || null) : undefined,
        autofertile: body.autofertile !== undefined ? body.autofertile : undefined,
        periodeRecolte: body.periodeRecolte !== undefined ? (body.periodeRecolte || null) : undefined,
        conservation: body.conservation !== undefined ? (body.conservation || null) : undefined,
        surfaceCanopee: body.surfaceCanopee !== undefined ? (body.surfaceCanopee ? parseFloat(body.surfaceCanopee) : null) : undefined,
        zoneId: body.zoneId !== undefined ? (body.zoneId ? parseInt(body.zoneId) : null) : undefined,
        parcelleGeoId: body.parcelleGeoId !== undefined ? (body.parcelleGeoId || null) : undefined,
        dateSuppression: body.dateSuppression !== undefined ? (body.dateSuppression ? new Date(body.dateSuppression) : null) : undefined,
        causeSuppression: body.causeSuppression !== undefined ? (body.causeSuppression || null) : undefined,
      },
      include: {
        zone: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json(arbre)
  } catch (err) {
    console.error("PUT /api/arbres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const arbreId = parseInt(id, 10)
    if (isNaN(arbreId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Verifier propriete
    const existing = await prisma.arbre.findUnique({
      where: {
        id: arbreId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Arbre non trouve" }, { status: 404 })
    }

    // Audit 2026-07 (#12) : la suppression cascade sur les récoltes de l'arbre,
    // mais laissait orphelines les écritures comptables auto (VenteManuelle
    // sourceType='recolte_arbre') → CA fantôme non nettoyable. Et une récolte
    // facturée disparaissait sans que la facture (document légal) soit traitée.
    const recoltes = await prisma.recolteArbre.findMany({
      where: { arbreId, userId: session!.user.id },
      select: { id: true, factureId: true },
    })
    const facturees = recoltes.filter((r) => r.factureId != null)
    if (facturees.length > 0) {
      return NextResponse.json(
        {
          error:
            `Suppression impossible : ${facturees.length} récolte(s) de cet arbre sont facturées. ` +
            `Annulez d'abord la ou les factures concernées, puis réessayez.`,
        },
        { status: 409 }
      )
    }

    const recolteIds = recoltes.map((r) => r.id)
    await prisma.$transaction(async (tx) => {
      // Supprimer les écritures auto liées aux récoltes (pas de FK, sinon orphelines)
      if (recolteIds.length > 0) {
        await tx.venteManuelle.deleteMany({
          where: {
            userId: session!.user.id,
            sourceType: "recolte_arbre",
            sourceId: { in: recolteIds },
            auto: true,
          },
        })
      }
      // La suppression de l'arbre cascade sur les récoltes (onDelete: Cascade)
      await tx.arbre.delete({ where: { id: arbreId } })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
