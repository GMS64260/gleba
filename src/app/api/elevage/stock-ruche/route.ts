/**
 * Sorties manuelles du stock de la ruche.
 * Les ventes sont exclusivement créées par /api/elevage/ventes afin que stock
 * et comptabilité restent dans la même transaction.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  sortirStockRuche,
  StockRucheError,
  verrouillerStockRuche,
} from "@/lib/elevage/stock-ruche"
import {
  PRODUITS_RUCHE,
  type ProduitRuche,
} from "@/lib/elevage/produits-ruche"
import { sortieStockRucheSchema } from "@/lib/validations/elevage-stock-ruche"

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = sortieStockRucheSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const operationId = await prisma.$transaction(async (tx) => {
      return sortirStockRuche(tx, {
        userId: session.user.id,
        produit: parsed.data.produit,
        unite: parsed.data.unite,
        date: parsed.data.date ?? new Date(),
        quantite: parsed.data.quantite,
        type: parsed.data.type,
        notes: parsed.data.notes ?? null,
      })
    })

    return NextResponse.json({ success: true, operationId }, { status: 201 })
  } catch (cause) {
    if (cause instanceof StockRucheError) {
      return NextResponse.json({ error: cause.message }, { status: cause.status })
    }
    console.error("POST /api/elevage/stock-ruche error:", cause)
    return NextResponse.json({ error: "Impossible d’enregistrer la sortie" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const operationId = new URL(request.url).searchParams.get("operationId")
    if (!operationId) {
      return NextResponse.json({ error: "Identifiant d’opération requis" }, { status: 400 })
    }

    const mouvement = await prisma.mouvementStockRuche.findFirst({
      where: { operationId, userId: session.user.id },
      select: {
        id: true,
        venteProduitId: true,
        production: { select: { produit: true } },
      },
    })
    if (!mouvement) {
      return NextResponse.json({ error: "Sortie introuvable" }, { status: 404 })
    }
    if (mouvement.venteProduitId) {
      return NextResponse.json(
        { error: "Cette sortie vient d’une vente : annulez ou modifiez la vente." },
        { status: 409 },
      )
    }

    if (!(PRODUITS_RUCHE as readonly string[]).includes(mouvement.production.produit)) {
      return NextResponse.json({ error: "Produit de la ruche invalide" }, { status: 409 })
    }
    await prisma.$transaction(async (tx) => {
      await verrouillerStockRuche(
        tx,
        session.user.id,
        mouvement.production.produit as ProduitRuche,
      )
      await tx.mouvementStockRuche.deleteMany({
        where: { operationId, userId: session.user.id, venteProduitId: null },
      })
    })
    return NextResponse.json({ success: true })
  } catch (cause) {
    console.error("DELETE /api/elevage/stock-ruche error:", cause)
    return NextResponse.json({ error: "Impossible de supprimer la sortie" }, { status: 500 })
  }
}
