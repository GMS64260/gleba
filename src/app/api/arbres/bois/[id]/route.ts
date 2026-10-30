import { prixFruitApi } from "@/lib/verger/creation-recolte"
import { modifierVenteVerger } from "@/lib/verger/vente"
import { ErreurVerger } from "@/lib/verger/erreur"
import { etatSortiesLotVerger, reliquatApresCorrection } from "@/lib/verger/sortie-stock"
import { quantiteBois } from "@/lib/commercial/stock-types"
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
import { requireAuthApi } from "@/lib/auth-utils"
import { deleteAutoEntry } from "@/lib/auto-compta"
import { annulerFactureLiee } from "@/lib/facture-utils"
import { m3PleinToStere } from "@/lib/recolte/lot"
import { refusTypeProductionBois } from "@/lib/verger/production-bois"

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
    return await prisma.$transaction(async (tx) => {
      await verrouillerStockCommercial(tx, session!.user.id)
      const existing = await tx.productionBois.findUnique({
        where: {
          id: productionId,
          userId: session!.user.id,
        },
      })

      if (!existing) {
        return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
      }
      // Revue du 2026-10-29 : seul un BL ou une facture fige le lot ; un usage
      // interne laisse corriger la production (voir plus bas).
      const sorties = await etatSortiesLotVerger(tx, session!.user.id, 'bois', existing)
      if (sorties.fige) return NextResponse.json({ error: 'Ce lot est lié à un document commercial. Préparez un BL pour livrer son reliquat ou utilisez Retour en stock sur le document.' }, { status: 409 })

      if (existing.statut === 'vendu' || existing.factureId) return NextResponse.json({ error: 'Ce lot est vendu. Corrigez la vente ou sa facture, ou annulez sa vente avant de modifier la récolte.' }, { status: 409 })
      const body = await request.json()

      // Même garde que la création (QA cmvnp0dm9) : un type hors liste n'aurait
      // aucun libellé à afficher sur la vente ni sur la facture.
      const refusType = body.type !== undefined ? refusTypeProductionBois(body.type) : null
      if (refusType) {
        return NextResponse.json({ error: refusType, champ: "type" }, { status: 400 })
      }

      // Lot déjà entamé par un usage interne : la production corrigée doit le
      // couvrir dans la même mesure, et le reliquat suit la nouvelle quantité.
      const volumeStere = body.volumeM3 !== undefined ? m3PleinToStere(body.volumeM3) : undefined
      const date = body.date ? new Date(body.date) : undefined
      const stockDisponibleCommercial = existing.stockDisponibleCommercial == null ? undefined
        : reliquatApresCorrection(sorties, {
          ...quantiteBois({
            volumeStere: volumeStere !== undefined ? volumeStere : existing.volumeStere,
            volumeM3: body.volumeM3 !== undefined ? body.volumeM3 : existing.volumeM3,
            poidsKg: body.poidsKg !== undefined ? body.poidsKg : existing.poidsKg,
          }),
          date: date ?? existing.date,
        })

      const production = await tx.productionBois.update({
        where: { id: productionId },
        data: {
          date,
          type: body.type,
          volumeM3: body.volumeM3,
          // Cohérence avec le POST : quand volumeM3 change, on recalcule
          // volumeStere via la même conversion (m3PleinToStere).
          volumeStere,
          poidsKg: body.poidsKg,
          stockDisponibleCommercial,
          destination: body.destination,
          prixVente: prixFruitApi(body.prixVente, "prixVente"),
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
    })
  } catch (err) {
    if (err instanceof ErreurVerger) return NextResponse.json({ error: err.message, champ: err.champ }, { status: err.status })
    if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot vient d’être lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error("PUT /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// PATCH : état relu sous verrou, source/facture/miroir/règlement atomiques.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  try {
    const { id } = await params
    return NextResponse.json(await modifierVenteVerger('bois', session!.user.id, session!.user.acteurId ?? session!.user.id, Number(id), await request.json()))
  } catch (err) {
    if (err instanceof ErreurVerger || err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status })
    if (String(err).includes('STOCK_COMMERCIAL_LIE')) return NextResponse.json({ error: 'Ce lot est lié à un document commercial. Actualisez les stocks.' }, { status: 409 })
    console.error('PATCH /api/arbres/bois/[id] error:', err)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
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

    await prisma.$transaction(async (tx) => {
      await verrouillerStockCommercial(tx, session!.user.id)
      const courante = await tx.productionBois.findFirst({ where: { id: productionId, userId: session!.user.id } })
      if (!courante) throw new ErreurReglement('Pièce introuvable.', 404)
      // Un lot sans BL ni facture se supprime avec son journal d'usages
      // internes (revue du 2026-10-29) ; un lot livré est conservé.
      const sorties = await etatSortiesLotVerger(tx, session!.user.id, 'bois', courante)
      if (sorties.fige) throw new ErreurReglement('Ce lot est lié à un document commercial. Conservez ses mouvements de stock.')
      if (sorties.sorties.length) await tx.mouvementStockCommercial.deleteMany({ where: { userId: session!.user.id, id: { in: sorties.sorties.map(m => m.id) } } })
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
