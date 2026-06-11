/**
 * API Production Bois individuelle
 * GET - Détail d'une production
 * PUT - Mise à jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { createVenteFromProductionBois, deleteAutoEntry } from "@/lib/auto-compta"
import { creerFacture } from "@/lib/facture-utils"
import { m3PleinToStere } from "@/lib/recolte/lot"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/bois/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const productionId = parseInt(id, 10)
    if (isNaN(productionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const production = await prisma.productionBois.findUnique({
      where: {
        id: productionId,
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

    if (!production) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    return NextResponse.json(production)
  } catch (err) {
    console.error("GET /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la production" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/bois/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const productionId = parseInt(id, 10)
    if (isNaN(productionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Vérifier propriété
    const existing = await prisma.productionBois.findUnique({
      where: {
        id: productionId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    const production = await prisma.productionBois.update({
      where: { id: productionId },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        type: body.type,
        volumeM3: body.volumeM3,
        // Cohérence avec le POST : quand volumeM3 change, on recalcule
        // volumeStere via la même conversion (m3PleinToStere).
        volumeStere: body.volumeM3 !== undefined ? m3PleinToStere(body.volumeM3) : undefined,
        poidsKg: body.poidsKg,
        destination: body.destination,
        prixVente: body.prixVente,
        notes: body.notes,
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
      },
    })

    return NextResponse.json(production)
  } catch (err) {
    console.error("PUT /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// PATCH /api/arbres/bois/[id] - Mise à jour partielle (vente, utilisation, perte)
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const productionId = parseInt(id, 10)
    if (isNaN(productionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.productionBois.findUnique({
      where: {
        id: productionId,
        userId: session!.user.id,
      },
      include: { arbre: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    const body = await request.json()
    const userId = session!.user.id

    // Préparer les données de mise à jour
    const updateData: any = {}
    if (body.statut !== undefined) {
      // Valider le statut
      const validStatuts = ["en_stock", "vendu", "utilise"]
      if (!validStatuts.includes(body.statut)) {
        return NextResponse.json(
          { error: `Statut invalide. Valeurs acceptées: ${validStatuts.join(", ")}` },
          { status: 400 }
        )
      }
      updateData.statut = body.statut
    }
    if (body.destination !== undefined) updateData.destination = body.destination
    if (body.dateVente !== undefined) updateData.dateVente = body.dateVente ? new Date(body.dateVente) : null
    if (body.prixVente !== undefined) updateData.prixVente = body.prixVente
    if (body.clientId !== undefined) updateData.clientId = body.clientId
    if (body.clientNom !== undefined) updateData.clientNom = body.clientNom
    if (body.notes !== undefined) updateData.notes = body.notes

    // Anti-double-facture : une production déjà facturée ne peut pas générer
    // une seconde facture (l'ancienne resterait comptée dans KPI/TVA/FEC).
    if (body.creerFacture && existing.factureId) {
      return NextResponse.json(
        { error: 'Cette production est déjà facturée', factureId: existing.factureId },
        { status: 409 }
      )
    }

    // Transaction atomique : facture + update production bois
    const production = await prisma.$transaction(async (tx) => {
      if (body.statut === "vendu" && body.creerFacture && body.prixVente) {
        // Bois = TVA 10 % (aligné sur l'écriture auto-compta, cf. auto-compta.ts)
        const totalHT = body.prixVente / 1.10
        const totalTVA = body.prixVente - totalHT
        const typeDescription = existing.type || 'Bois'
        const arbreInfo = existing.arbre ? ` - ${existing.arbre.nom}` : ''
        const volumeInfo = existing.volumeM3 ? ` (${existing.volumeM3} m³)` : ''

        const facture = await creerFacture(tx, {
          userId,
          type: 'facture',
          clientId: body.clientId || null,
          clientNom: body.clientNom,
          objet: `Vente de bois - ${typeDescription}${volumeInfo}`,
          totalHT,
          totalTVA,
          totalTTC: body.prixVente,
          statut: 'payee',
          datePaiement: new Date(),
          modePaiement: 'especes',
          lignes: [{
            description: `${typeDescription}${arbreInfo}`,
            quantite: existing.volumeM3 || 1,
            unite: existing.volumeM3 ? 'm³' : 'lot',
            prixUnitaire: totalHT / (existing.volumeM3 || 1),
            tauxTVA: 10,
            montantHT: totalHT,
            montantTVA: totalTVA,
            montantTTC: body.prixVente,
          }],
        })

        updateData.factureId = facture.id
      }

      return tx.productionBois.update({
        where: { id: productionId },
        data: updateData,
        include: {
          arbre: {
            select: {
              id: true,
              nom: true,
              type: true,
              espece: true,
            },
          },
          facture: {
            select: {
              id: true,
              numero: true,
              type: true,
              clientNom: true,
              totalTTC: true,
              statut: true,
            },
          },
        },
      })
    })

    // Auto-comptabilite : gerer les ecritures automatiques
    try {
      if (body.statut === 'vendu' && body.prixVente) {
        await createVenteFromProductionBois(userId, {
          id: productionId,
          type: existing.type,
          volumeM3: existing.volumeM3,
          poidsKg: existing.poidsKg,
          prixVente: body.prixVente,
          clientNom: body.clientNom ?? existing.clientNom,
          clientId: body.clientId ?? existing.clientId,
          dateVente: body.dateVente ?? existing.dateVente,
          arbre: existing.arbre ? { nom: existing.arbre.nom, espece: existing.arbre.espece } : null,
          factureId: production.factureId,
        })
      } else if (existing.statut === 'vendu' && body.statut && body.statut !== 'vendu') {
        await deleteAutoEntry('production_bois', productionId, 'vente')
      }
    } catch (autoComptaError) {
      console.error('Auto-compta error (production_bois):', autoComptaError)
    }

    return NextResponse.json(production)
  } catch (err) {
    console.error("PATCH /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/bois/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const productionId = parseInt(id, 10)
    if (isNaN(productionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Vérifier propriété
    const existing = await prisma.productionBois.findUnique({
      where: {
        id: productionId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    // Supprimer les ecritures auto-compta liees
    if (existing.statut === 'vendu') {
      try {
        await deleteAutoEntry('production_bois', productionId, 'vente')
      } catch (autoComptaError) {
        console.error('Auto-compta cleanup error (production_bois):', autoComptaError)
      }
    }

    await prisma.productionBois.delete({
      where: { id: productionId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
