/**
 * API Récolte Arbre individuelle (avec gestion stock/vente)
 * GET - Détail d'une recolte
 * PUT - Mise à jour complète
 * PATCH - Transition de statut (vente, perte, etc.)
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { createVenteFromRecolteArbre, deleteAutoEntry } from "@/lib/auto-compta"
import { creerFacture, annulerFactureLiee } from "@/lib/facture-utils"
import { estNumeroLotAuto, genererNumeroLot } from "@/lib/recolte/lot"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/recoltes/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const recolte = await prisma.recolteArbre.findUnique({
      where: {
        id: recolteId,
        userId: session!.user.id,
      },
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
    })

    if (!recolte) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    return NextResponse.json(recolte)
  } catch (err) {
    console.error("GET /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la récolte" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/recoltes/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const userId = session!.user.id
    const existing = await prisma.recolteArbre.findUnique({
      where: { id: recolteId, userId },
      include: { arbre: { select: { espece: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    // Production 2026-09-04 : un maraîcher a saisi deux fois la même récolte à
    // une minute d'écart, seule la date différait — l'écran n'offrait aucune
    // modification, seulement la suppression. La route acceptait déjà PUT,
    // mais sans contrôle : on valide ici ce que le formulaire peut désormais
    // corriger (date, quantité, qualité, prix, péremption, parcelle d'origine,
    // catégorie, destination, conditionnement, notes, n° de lot).
    if (body.quantite !== undefined) {
      if (typeof body.quantite !== "number" || !isFinite(body.quantite) || body.quantite <= 0) {
        return NextResponse.json(
          { error: "La quantité doit être un nombre supérieur à 0" },
          { status: 400 }
        )
      }
    }

    let nouvelleDate: Date | undefined
    if (body.date !== undefined && body.date !== null && body.date !== "") {
      nouvelleDate = new Date(body.date)
      if (isNaN(nouvelleDate.getTime())) {
        return NextResponse.json({ error: "Date de récolte invalide" }, { status: 400 })
      }
    }

    // Parcelle d'origine : `null` explicite la retire, `undefined` la laisse.
    let nouvelleParcelleId: string | null | undefined
    let nouvelleParcelleNom: string | null = null
    if (body.parcelleId !== undefined) {
      if (body.parcelleId === null || body.parcelleId === "") {
        nouvelleParcelleId = null
      } else {
        const parcelle = await prisma.parcelleGeo.findFirst({
          where: { id: String(body.parcelleId), userId },
          select: { id: true, nom: true },
        })
        if (!parcelle) {
          return NextResponse.json({ error: "Parcelle non trouvée" }, { status: 404 })
        }
        nouvelleParcelleId = parcelle.id
        nouvelleParcelleNom = parcelle.nom
      }
    }

    // Numéro de lot : un numéro saisi explicitement gagne toujours. Sinon, si
    // la date ou la parcelle change et que le lot courant est automatique, on
    // le régénère (le lot encode la date et la parcelle) ; un lot saisi à la
    // main par l'utilisateur n'est jamais écrasé.
    let numLot: string | undefined
    if (typeof body.numLot === "string" && body.numLot.trim()) {
      numLot = body.numLot.trim()
    } else {
      const dateChange = nouvelleDate !== undefined && nouvelleDate.getTime() !== existing.date.getTime()
      const parcelleChange = nouvelleParcelleId !== undefined && nouvelleParcelleId !== existing.parcelleId
      if ((dateChange || parcelleChange) && estNumeroLotAuto(existing.numLot)) {
        const dateLot = nouvelleDate ?? existing.date
        const parcelleIdLot = nouvelleParcelleId !== undefined ? nouvelleParcelleId : existing.parcelleId
        let parcelleNomLot = nouvelleParcelleNom
        if (!parcelleNomLot && parcelleIdLot) {
          parcelleNomLot =
            (await prisma.parcelleGeo.findUnique({ where: { id: parcelleIdLot }, select: { nom: true } }))?.nom ??
            null
        }
        const dayStart = new Date(dateLot)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dateLot)
        dayEnd.setHours(23, 59, 59, 999)
        const sameDayCount = await prisma.recolteArbre.count({
          where: {
            userId,
            id: { not: recolteId },
            date: { gte: dayStart, lte: dayEnd },
            ...(parcelleIdLot ? { parcelleId: parcelleIdLot } : {}),
            arbre: { espece: existing.arbre?.espece ?? undefined },
          },
        })
        numLot = genererNumeroLot({
          date: dateLot,
          parcelleNom: parcelleNomLot,
          espece: existing.arbre?.espece ?? null,
          numeroSequence: sameDayCount + 1,
        })
      }
    }

    const texteOuNull = (v: unknown): string | null | undefined =>
      v === undefined ? undefined : typeof v === "string" && v.trim() ? v.trim() : null

    const recolte = await prisma.recolteArbre.update({
      where: { id: recolteId },
      data: {
        date: nouvelleDate,
        quantite: body.quantite,
        qualite: texteOuNull(body.qualite),
        prixKg: body.prixKg === undefined ? undefined : typeof body.prixKg === "number" ? body.prixKg : null,
        datePeremption: body.datePeremption !== undefined
          ? (body.datePeremption ? new Date(body.datePeremption) : null)
          : undefined,
        notes: texteOuNull(body.notes),
        parcelleId: nouvelleParcelleId,
        numLot,
        categorieCommerciale: texteOuNull(body.categorieCommerciale),
        destinationCommerce: texteOuNull(body.destinationCommerce),
        conditionnement: texteOuNull(body.conditionnement),
        statutBioSnapshot: texteOuNull(body.statutBioSnapshot),
      },
      include: {
        arbre: {
          select: { id: true, nom: true, type: true, espece: true },
        },
        parcelle: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json(recolte)
  } catch (err) {
    console.error("PUT /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// PATCH /api/arbres/recoltes/[id] - Transition de statut
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const userId = session!.user.id

    const existing = await prisma.recolteArbre.findUnique({
      where: { id: recolteId, userId },
      include: {
        arbre: {
          select: { id: true, nom: true, espece: true, variete: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    // Préparer les données de mise à jour
    const updateData: any = {}
    if (body.statut !== undefined) updateData.statut = body.statut
    if (body.dateVente !== undefined) updateData.dateVente = body.dateVente ? new Date(body.dateVente) : null
    if (body.prixKg !== undefined) updateData.prixKg = body.prixKg
    if (body.prixTotal !== undefined) updateData.prixTotal = body.prixTotal
    if (body.clientId !== undefined) updateData.clientId = body.clientId
    if (body.clientNom !== undefined) updateData.clientNom = body.clientNom
    if (body.datePeremption !== undefined) updateData.datePeremption = body.datePeremption ? new Date(body.datePeremption) : null
    if (body.notes !== undefined) updateData.notes = body.notes

    // Sécurité multi-tenant : un clientId fourni doit appartenir à l'utilisateur
    // (il est persisté sur la récolte, l'écriture auto et la facture).
    if (body.clientId) {
      const clientOk = await prisma.client.findFirst({
        where: { id: body.clientId, userId },
        select: { id: true },
      })
      if (!clientOk) {
        return NextResponse.json({ error: 'Client introuvable' }, { status: 400 })
      }
    }

    // Anti-double-facture : une récolte déjà facturée ne peut pas générer
    // une seconde facture (l'ancienne resterait comptée dans KPI/TVA/FEC).
    if (body.creerFacture && existing.factureId) {
      return NextResponse.json(
        { error: 'Cette récolte est déjà facturée', factureId: existing.factureId },
        { status: 409 }
      )
    }

    // Dé-vente d'une récolte facturée (retour en stock) : la facture doit
    // suivre, sinon le CA reste compté via la facture (CA fantôme).
    if (
      existing.factureId &&
      existing.statut === 'vendu' &&
      body.statut &&
      body.statut !== 'vendu'
    ) {
      const liee = await annulerFactureLiee(prisma, userId, existing.factureId)
      if (!liee.ok) {
        return NextResponse.json({ error: liee.raison }, { status: 409 })
      }
      updateData.factureId = null
    }

    // Transaction atomique : facture + update recolte arbre
    const recolte = await prisma.$transaction(async (tx) => {
      if (body.statut === "vendu" && body.creerFacture && body.prixTotal) {
        const totalHT = body.prixTotal / 1.055
        const totalTVA = body.prixTotal - totalHT
        const arbreNom = existing.arbre?.nom || 'Fruits'
        const especeNom = existing.arbre?.espece || ''

        const facture = await creerFacture(tx, {
          userId,
          type: 'facture',
          clientId: body.clientId || null,
          clientNom: body.clientNom,
          objet: `Vente de ${arbreNom}${especeNom ? ` (${especeNom})` : ''}`,
          totalHT,
          totalTVA,
          totalTTC: body.prixTotal,
          statut: 'payee',
          datePaiement: new Date(),
          modePaiement: 'especes',
          lignes: [{
            description: `${arbreNom}${especeNom ? ` - ${especeNom}` : ''}`,
            quantite: existing.quantite,
            unite: 'kg',
            prixUnitaire: (body.prixKg || 0) / 1.055,
            tauxTVA: 5.5,
            montantHT: totalHT,
            montantTVA: totalTVA,
            montantTTC: body.prixTotal,
          }],
        })

        updateData.factureId = facture.id
      }

      if (body.statut === "vendu") {
        updateData.dateVente = updateData.dateVente || new Date()
      }

      return tx.recolteArbre.update({
        where: { id: recolteId },
        data: updateData,
        include: {
          arbre: {
            select: { id: true, nom: true, type: true, espece: true },
          },
        },
      })
    })

    // Auto-comptabilite : gerer les ecritures automatiques
    try {
      if (body.statut === 'vendu' && (body.prixTotal || body.prixKg)) {
        await createVenteFromRecolteArbre(userId, {
          id: recolteId,
          quantite: existing.quantite,
          prixKg: body.prixKg ?? existing.prixKg,
          prixTotal: body.prixTotal ?? existing.prixTotal,
          clientNom: body.clientNom ?? existing.clientNom,
          clientId: body.clientId ?? existing.clientId,
          dateVente: body.dateVente ?? existing.dateVente,
          arbre: existing.arbre ? { nom: existing.arbre.nom, espece: existing.arbre.espece } : null,
          factureId: recolte.factureId,
        })
      } else if (existing.statut === 'vendu' && body.statut && body.statut !== 'vendu') {
        await deleteAutoEntry('recolte_arbre', recolteId, 'vente')
      }
    } catch (autoComptaError) {
      console.error('Auto-compta error (recolte_arbre):', autoComptaError)
    }

    return NextResponse.json(recolte)
  } catch (err) {
    console.error("PATCH /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/recoltes/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.recolteArbre.findUnique({
      where: { id: recolteId, userId: session!.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    // Supprimer une récolte facturée laisserait une facture orpheline comptée
    // dans KPI/TVA/FEC : la facture doit être annulée (ou couverte par un avoir).
    if (existing.factureId) {
      const liee = await annulerFactureLiee(prisma, session!.user.id, existing.factureId)
      if (!liee.ok) {
        return NextResponse.json({ error: liee.raison }, { status: 409 })
      }
    }

    // Supprimer les ecritures auto-compta liees
    if (existing.statut === 'vendu') {
      try {
        await deleteAutoEntry('recolte_arbre', recolteId, 'vente')
      } catch (autoComptaError) {
        console.error('Auto-compta cleanup error (recolte_arbre):', autoComptaError)
      }
    }

    await prisma.recolteArbre.delete({
      where: { id: recolteId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
