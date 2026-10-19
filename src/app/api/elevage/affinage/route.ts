/**
 * API Cave / affinage (PROMPT 27).
 * GET  → inventaire : par lot fromage, stock restant (fabrication − sorties),
 *        état, DLC/DLUO et jours restants, valorisation (règles :
 *        `src/lib/elevage/cave-fromage.ts`).
 * PATCH → met à jour l'état et/ou la DLC d'un lot.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { stockDuLotFromage } from '@/lib/elevage/stock-fromage'
import { valoriserStockFromage } from '@/lib/elevage/cave-fromage'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session.user.id
  const { searchParams } = new URL(request.url)
  const inclureEcoules = searchParams.get('inclureEcoules') === '1'

  const lots = await prisma.lotFromage.findMany({
    where: { userId },
    orderBy: { dateFabrication: 'desc' },
    include: {
      mouvements: { select: { nbPieces: true, poidsKg: true } },
      ventesProduit: { where: { annule: false }, select: { quantite: true, unite: true, prixTotal: true } },
    },
  })

  const now = Date.now()
  const data = lots.map((l) => {
    // Stock et valorisation : règle unique de `cave-fromage.ts`. Une vente à la
    // pièce sans pesée retire le poids moyen d'une pièce, et le prix constaté
    // garde l'unité des ventes (QA 2026-10-19 : 2 pièces à 2 €/pièce étaient
    // valorisées 0,3 kg × 2 € = 0,60 €).
    const stock = stockDuLotFromage(l)
    const { valorisation, prix } = valoriserStockFromage(
      { nbPieces: l.nbPieces, poidsTotalKg: Number(l.poidsTotalKg) || 0 },
      stock,
      l.ventesProduit.map((v) => ({ quantite: Number(v.quantite), unite: v.unite, prixTotal: Number(v.prixTotal) })),
    )
    const echeance = l.dlc ?? l.dluo
    const joursRestants = echeance ? Math.floor((new Date(echeance).getTime() - now) / 86_400_000) : null

    return {
      id: l.id,
      numeroLot: l.numeroLot,
      typeFromage: l.typeFromage,
      dateFabrication: l.dateFabrication,
      etat: l.etat,
      dluo: l.dluo,
      dlc: l.dlc,
      echeanceType: l.dlc ? 'DLC' : l.dluo ? 'DLUO' : null,
      joursRestants,
      nbPiecesInitial: l.nbPieces,
      poidsTotalKg: Number(l.poidsTotalKg),
      stockPieces: stock.restantPieces,
      stockKg: stock.restantKg,
      // Prix moyen constaté des ventes du lot, dans leur unité (€/pièce ou €/kg).
      prixConstate: prix?.montant ?? null,
      unitePrixConstate: prix?.unite ?? null,
      valorisation,
      traitementThermique: l.traitementThermique,
    }
  })

  const visibles = inclureEcoules ? data : data.filter((l) => l.etat !== 'ecoule' && l.stockPieces > 0)

  const stats = {
    nbLots: visibles.length,
    // Lots écartés par la vue par défaut (écoulés, ou épuisés par le calcul
    // alors qu'ils sont encore « prêts » en base) : l'écran les nomme.
    nbLotsMasques: data.length - visibles.length,
    stockPiecesTotal: visibles.reduce((s, l) => s + l.stockPieces, 0),
    stockKgTotal: Math.round(visibles.reduce((s, l) => s + l.stockKg, 0) * 100) / 100,
    valorisationTotale: Math.round(
      visibles.reduce((s, l) => s + (l.valorisation ?? 0), 0) * 100
    ) / 100,
    nbAlerteDlc: visibles.filter((l) => l.joursRestants != null && l.joursRestants <= 7).length,
  }

  return NextResponse.json({ data: visibles, stats })
}

const patchSchema = z.object({
  id: z.string().min(1),
  etat: z.enum(['affinage', 'pret', 'ecoule']).optional(),
  dlc: z.coerce.date().nullable().optional(),
})

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, ...updates } = parsed.data
    const existing = await prisma.lotFromage.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    const lot = await prisma.lotFromage.update({ where: { id }, data: updates })
    return NextResponse.json({ data: lot })
  } catch (err) {
    console.error('PATCH /api/elevage/affinage error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
