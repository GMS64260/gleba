/**
 * API Produits de la ruche
 * GET    /api/elevage/production-ruche - Récoltes et totaux annuels
 * POST   /api/elevage/production-ruche - Enregistrer une récolte
 * PATCH  /api/elevage/production-ruche - Modifier une récolte
 * DELETE /api/elevage/production-ruche?id= - Supprimer une récolte
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  estLotApicole,
  PRODUITS_RUCHE,
  UNITES_PRODUITS_RUCHE,
  type ProduitRuche,
  type UniteProduitRuche,
  uniteProduitRucheParDefaut,
} from "@/lib/elevage/produits-ruche"
import {
  convertirQuantiteProduitRuche,
  StockRucheError,
  verrouillerStockRuche,
} from "@/lib/elevage/stock-ruche"
import { computeProductionsRuche } from "@/lib/elevage/productions-ruche-lecture"
import { productionRucheSchema } from "@/lib/validations/elevage-production-ruche"

const especeApicoleSelect = {
  select: {
    id: true,
    nom: true,
    production: true,
    productions: true,
    categorieReglementaire: true,
  },
} as const

const lotApicoleSelect = {
  id: true,
  nom: true,
  statut: true,
  especeAnimale: especeApicoleSelect,
} as const

// QA cmsbtlka1 — les ruches gérées en animaux individuels (hors lot) sont des
// cibles de récolte au même titre que les lots apicoles.
const animalApicoleSelect = {
  id: true,
  nom: true,
  identifiant: true,
  statut: true,
  especeAnimale: especeApicoleSelect,
} as const

async function verifierCibleApicole(
  lotId: number | null | undefined,
  animalId: number | null | undefined,
  userId: string,
) {
  if (lotId) {
    const lot = await prisma.lotAnimaux.findFirst({
      where: { id: lotId, userId },
      select: lotApicoleSelect,
    })
    if (!lot) {
      return { error: NextResponse.json({ error: "Ruche ou lot introuvable" }, { status: 404 }) }
    }
    if (!estLotApicole(lot)) {
      return {
        error: NextResponse.json(
          { error: "Le lot sélectionné n’est pas identifié comme apicole" },
          { status: 400 }
        ),
      }
    }
    return { lot }
  }
  if (animalId) {
    const animal = await prisma.animal.findFirst({
      where: { id: animalId, userId },
      select: animalApicoleSelect,
    })
    if (!animal) {
      return { error: NextResponse.json({ error: "Ruche ou lot introuvable" }, { status: 404 }) }
    }
    if (!estLotApicole(animal)) {
      return {
        error: NextResponse.json(
          { error: "La ruche sélectionnée n’est pas identifiée comme apicole" },
          { status: 400 }
        ),
      }
    }
    return { animal }
  }
  return null
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = Number.parseInt(searchParams.get("annee") ?? String(new Date().getFullYear()), 10)
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") ?? "200", 10) || 200, 1), 500)
    if (!Number.isInteger(annee) || annee < 1990 || annee > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: "Année invalide" }, { status: 400 })
    }

    // La lecture récoltes/totaux/stocks vit dans
    // src/lib/elevage/productions-ruche-lecture.ts (SSOT partagée avec
    // l'outil assistant `get_productions_ruche`) — lot assistant 2026-08-11.
    const [lecture, lots, animaux, mouvementsStock] = await Promise.all([
      computeProductionsRuche(session.user.id, annee, limit),
      prisma.lotAnimaux.findMany({
        where: { userId: session.user.id, statut: "actif" },
        orderBy: { nom: "asc" },
        select: lotApicoleSelect,
      }),
      prisma.animal.findMany({
        where: { userId: session.user.id, statut: "actif", lotId: null },
        orderBy: [{ nom: "asc" }, { identifiant: "asc" }],
        select: animalApicoleSelect,
      }),
      prisma.mouvementStockRuche.findMany({
        where: { userId: session.user.id, venteProduitId: null },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 200,
        select: {
          operationId: true,
          date: true,
          type: true,
          quantite: true,
          notes: true,
          production: { select: { produit: true, unite: true } },
        },
      }),
    ])

    const sortiesParOperation = new Map<string, {
      operationId: string
      date: Date
      type: string
      produit: string
      unite: string
      quantite: number
      notes: string | null
    }>()
    for (const mouvement of mouvementsStock) {
      if (!(PRODUITS_RUCHE as readonly string[]).includes(mouvement.production.produit)) continue
      if (!(UNITES_PRODUITS_RUCHE as readonly string[]).includes(mouvement.production.unite)) continue
      const produit = mouvement.production.produit as ProduitRuche
      const unite = uniteProduitRucheParDefaut(produit)
      const quantite = convertirQuantiteProduitRuche(
        mouvement.quantite,
        mouvement.production.unite as UniteProduitRuche,
        unite,
      )
      const existante = sortiesParOperation.get(mouvement.operationId)
      if (existante) {
        existante.quantite += quantite
      } else {
        sortiesParOperation.set(mouvement.operationId, {
          operationId: mouvement.operationId,
          date: mouvement.date,
          type: mouvement.type,
          produit,
          unite,
          quantite,
          notes: mouvement.notes,
        })
      }
    }

    return NextResponse.json({
      data: lecture.data,
      stats: lecture.stats,
      stocks: lecture.stocks,
      mouvements: [...sortiesParOperation.values()].slice(0, 50),
      lots: lots.filter(estLotApicole),
      ruches: animaux.filter(estLotApicole),
      meta: lecture.meta,
    })
  } catch (cause) {
    console.error("GET /api/elevage/production-ruche error:", cause)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des produits de la ruche" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = productionRucheSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const cibleResult = await verifierCibleApicole(parsed.data.lotId, parsed.data.animalId, session.user.id)
    if (cibleResult?.error) return cibleResult.error

    const production = await prisma.$transaction(async (tx) => {
      await verrouillerStockRuche(tx, session.user.id, parsed.data.produit)
      return tx.productionRuche.create({
        data: {
          userId: session.user.id,
          date: parsed.data.date ?? new Date(),
          produit: parsed.data.produit,
          quantite: parsed.data.quantite,
          unite: parsed.data.unite,
          lotId: parsed.data.lotId ?? null,
          animalId: parsed.data.animalId ?? null,
          numeroLot: parsed.data.numeroLot || null,
          notes: parsed.data.notes || null,
        },
        include: {
          lot: {
            select: {
              id: true,
              nom: true,
              especeAnimale: { select: { nom: true } },
            },
          },
          animal: {
            select: {
              id: true,
              nom: true,
              identifiant: true,
              especeAnimale: { select: { nom: true } },
            },
          },
        },
      })
    })

    return NextResponse.json({ data: production }, { status: 201 })
  } catch (cause) {
    console.error("POST /api/elevage/production-ruche error:", cause)
    return NextResponse.json({ error: "Impossible d’enregistrer la récolte" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }
    const parsed = productionRucheSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await prisma.productionRuche.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, produit: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Récolte introuvable" }, { status: 404 })
    }

    const cibleResult = await verifierCibleApicole(parsed.data.lotId, parsed.data.animalId, session.user.id)
    if (cibleResult?.error) return cibleResult.error

    const production = await prisma.$transaction(async (tx) => {
      const produitsAVerrouiller = [existing.produit, parsed.data.produit]
        .filter((produit, index, liste) => liste.indexOf(produit) === index)
        .sort()
      for (const produit of produitsAVerrouiller) {
        await verrouillerStockRuche(tx, session.user.id, produit as ProduitRuche)
      }

      const courante = await tx.productionRuche.findFirst({
        where: { id, userId: session.user.id },
        select: {
          id: true,
          date: true,
          produit: true,
          unite: true,
          mouvementsStock: {
            select: { quantite: true, date: true },
            orderBy: { date: "asc" },
          },
        },
      })
      if (!courante) throw new StockRucheError("Récolte introuvable", 404)

      const quantiteSortie = courante.mouvementsStock.reduce(
        (somme, mouvement) => somme + mouvement.quantite,
        0,
      )
      if (
        courante.mouvementsStock.length > 0 &&
        (parsed.data.produit !== courante.produit || parsed.data.unite !== courante.unite)
      ) {
        throw new StockRucheError(
          "Cette récolte a déjà alimenté des sorties : son produit et son unité ne peuvent plus changer.",
        )
      }
      if (parsed.data.quantite + 1e-6 < quantiteSortie) {
        throw new StockRucheError(
          `Quantité impossible : ${quantiteSortie.toLocaleString("fr-FR", {
            maximumFractionDigits: 3,
          })} ${courante.unite} sont déjà sortis de cette récolte.`,
        )
      }
      const nouvelleDate = parsed.data.date ?? courante.date
      const premiereSortie = courante.mouvementsStock[0]?.date
      if (premiereSortie && nouvelleDate > premiereSortie) {
        throw new StockRucheError(
          "La date de récolte ne peut pas être postérieure à une sortie de stock déjà enregistrée.",
        )
      }

      return tx.productionRuche.update({
        where: { id },
        data: {
          date: nouvelleDate,
          produit: parsed.data.produit,
          quantite: parsed.data.quantite,
          unite: parsed.data.unite,
          lotId: parsed.data.lotId ?? null,
          animalId: parsed.data.animalId ?? null,
          numeroLot: parsed.data.numeroLot || null,
          notes: parsed.data.notes || null,
        },
        include: {
          lot: {
            select: {
              id: true,
              nom: true,
              especeAnimale: { select: { nom: true } },
            },
          },
          animal: {
            select: {
              id: true,
              nom: true,
              identifiant: true,
              especeAnimale: { select: { nom: true } },
            },
          },
        },
      })
    })

    return NextResponse.json({ data: production })
  } catch (cause) {
    if (cause instanceof StockRucheError) {
      return NextResponse.json({ error: cause.message }, { status: cause.status })
    }
    console.error("PATCH /api/elevage/production-ruche error:", cause)
    return NextResponse.json({ error: "Impossible de modifier la récolte" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const id = Number(new URL(request.url).searchParams.get("id"))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 })
    }
    const production = await prisma.productionRuche.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, _count: { select: { mouvementsStock: true } } },
    })
    if (!production) {
      return NextResponse.json({ error: "Récolte introuvable" }, { status: 404 })
    }
    if (production._count.mouvementsStock > 0) {
      return NextResponse.json(
        { error: "Cette récolte a déjà alimenté le stock : supprimez ou annulez d’abord les sorties associées." },
        { status: 409 },
      )
    }
    await prisma.$transaction(async (tx) => {
      const courante = await tx.productionRuche.findFirst({
        where: { id: production.id, userId: session.user.id },
        select: { id: true, produit: true },
      })
      if (!courante) throw new StockRucheError("Récolte introuvable", 404)
      await verrouillerStockRuche(tx, session.user.id, courante.produit as ProduitRuche)
      const mouvements = await tx.mouvementStockRuche.count({
        where: { productionId: courante.id, userId: session.user.id },
      })
      if (mouvements > 0) {
        throw new StockRucheError(
          "Cette récolte a déjà alimenté le stock : supprimez ou annulez d’abord les sorties associées.",
        )
      }
      await tx.productionRuche.delete({ where: { id: courante.id } })
    })
    return NextResponse.json({ success: true })
  } catch (cause) {
    if (cause instanceof StockRucheError) {
      return NextResponse.json({ error: cause.message }, { status: cause.status })
    }
    console.error("DELETE /api/elevage/production-ruche error:", cause)
    return NextResponse.json({ error: "Impossible de supprimer la récolte" }, { status: 500 })
  }
}
