import { verrouillerStockCommercial } from '@/lib/stocks/verrou-commercial'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
/**
 * API Production Bois individuelle
 * GET - Détail d'une production
 * PUT - Mise à jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireAuthApi } from "@/lib/auth-utils"
import { createVenteFromProductionBois, deleteAutoEntry } from "@/lib/auto-compta"
import { creerFacture, annulerFactureLiee } from "@/lib/facture-utils"
import { m3PleinToStere } from "@/lib/recolte/lot"
import { libellesVenteBois, refusTypeProductionBois } from "@/lib/verger/production-bois"

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
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
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

    if (existing?.stockDisponibleCommercial != null) return NextResponse.json({ error: 'Ce lot est lié à un document commercial. Préparez un BL pour livrer son reliquat ou utilisez Retour en stock sur le document.' }, { status: 409 })
    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    // Même garde que la création (QA cmvnp0dm9) : un type hors liste n'aurait
    // aucun libellé à afficher sur la vente ni sur la facture.
    const refusType = body.type !== undefined ? refusTypeProductionBois(body.type) : null
    if (refusType) {
      return NextResponse.json({ error: refusType, champ: "type" }, { status: 400 })
    }

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
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
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

    if (existing?.stockDisponibleCommercial != null) return NextResponse.json({ error: 'Ce lot est lié à un document commercial. Préparez un BL pour livrer son reliquat ou utilisez Retour en stock sur le document.' }, { status: 409 })
    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    const body = await request.json()
    const userId = session!.user.id

    // Préparer les données de mise à jour
    const updateData: Prisma.ProductionBoisUncheckedUpdateInput = {}
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

    // Sécurité multi-tenant : un clientId fourni doit appartenir à l'utilisateur
    // (il est persisté sur la production, l'écriture auto et la facture).
    if (body.clientId) {
      const clientOk = await prisma.client.findFirst({
        where: { id: body.clientId, userId },
        select: { id: true },
      })
      if (!clientOk) {
        return NextResponse.json({ error: 'Client introuvable' }, { status: 400 })
      }
    }

    // Anti-double-facture : une production déjà facturée ne peut pas générer
    // une seconde facture (l'ancienne resterait comptée dans KPI/TVA/FEC).
    if (body.creerFacture && existing.factureId) {
      return NextResponse.json(
        { error: 'Cette production est déjà facturée', factureId: existing.factureId },
        { status: 409 }
      )
    }

    // Dé-vente d'une production facturée (retour en stock/utilisé) : la
    // facture doit suivre, sinon le CA reste compté via la facture.
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

    // Transaction atomique : facture + update production bois
    const production = await prisma.$transaction(async (tx) => {
      await verrouillerStockCommercial(tx, userId)
      if (body.statut === "vendu" && body.creerFacture && body.prixVente) {
        // Bois = TVA 10 % (aligné sur l'écriture auto-compta, cf. auto-compta.ts)
        const totalHT = body.prixVente / 1.10
        const totalTVA = body.prixVente - totalHT
        // QA cmvnp0dm9 — libellés tirés de la source partagée avec l'écran
        // (« Élagage », « 0,2 m³ »), jamais de la valeur technique.
        const textes = libellesVenteBois({
          type: existing.type,
          volumeM3: existing.volumeM3,
          poidsKg: existing.poidsKg,
          arbreNom: existing.arbre?.nom,
        })

        const facture = await creerFacture(tx, {
          userId,
          type: 'facture',
          clientId: body.clientId || null,
          clientNom: body.clientNom,
          objet: textes.objetFacture,
          totalHT,
          totalTVA,
          totalTTC: body.prixVente,
          statut: 'payee',
          datePaiement: new Date(),
          modePaiement: 'especes',
          lignes: [{
            description: textes.ligneFacture,
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

      const updated = await tx.productionBois.update({
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
      if (updated.statut === 'vendu') {
        await createVenteFromProductionBois(userId, { ...updated, arbre: existing.arbre ? { nom: existing.arbre.nom, espece: existing.arbre.espece } : null }, tx)
      } else if (existing.statut === 'vendu') {
        await deleteAutoEntry('production_bois', productionId, 'vente', userId, tx)
      }
      return updated
    })

    return NextResponse.json(production)
  } catch (err) {
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
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

    if (existing?.stockDisponibleCommercial != null) return NextResponse.json({ error: 'Ce lot est lié à un document commercial. Préparez un BL pour livrer son reliquat ou utilisez Retour en stock sur le document.' }, { status: 409 })
    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await verrouillerStockCommercial(tx, session!.user.id)
      const courante = await tx.productionBois.findFirst({ where: { id: productionId, userId: session!.user.id } })
      if (!courante) throw new ErreurReglement('Pièce introuvable.', 404)
      if (courante.stockDisponibleCommercial != null) throw new ErreurReglement('Ce lot est lié à un document commercial. Conservez ses mouvements de stock.')
      if (courante.factureId) {
        const liee = await annulerFactureLiee(tx, session!.user.id, courante.factureId)
        if (!liee.ok) throw new ErreurReglement(liee.raison)
      }
      await deleteAutoEntry('production_bois', productionId, 'vente', session!.user.id, tx)
      await tx.productionBois.delete({ where: { id: productionId, userId: session!.user.id } })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error("DELETE /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
