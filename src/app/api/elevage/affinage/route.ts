/**
 * API Cave / affinage (PROMPT 27).
 * GET  → inventaire : par lot fromage, stock restant (fabrication − sorties),
 *        état, DLC/DLUO et jours restants, valorisation.
 * PATCH → met à jour l'état et/ou la DLC d'un lot.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

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
      ventesProduit: { where: { annule: false }, select: { quantite: true, prixTotal: true } },
    },
  })

  const now = Date.now()
  const data = lots.map((l) => {
    const sortiesPieces = l.mouvements.reduce((s, m) => s + m.nbPieces, 0)
    const sortiesKg = l.mouvements.reduce((s, m) => s + Number(m.poidsKg), 0)
    const stockPieces = l.nbPieces - sortiesPieces
    const stockKg = Math.round((Number(l.poidsTotalKg) - sortiesKg) * 1000) / 1000
    // Prix moyen au kg constaté sur les ventes du lot
    const kgVendus = l.ventesProduit.reduce((s, v) => s + Number(v.quantite), 0)
    const caVentes = l.ventesProduit.reduce((s, v) => s + Number(v.prixTotal), 0)
    const prixMoyenKg = kgVendus > 0 ? caVentes / kgVendus : null
    const valorisation = prixMoyenKg != null ? Math.round(prixMoyenKg * stockKg * 100) / 100 : null
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
      stockPieces,
      stockKg,
      prixMoyenKg: prixMoyenKg != null ? Math.round(prixMoyenKg * 100) / 100 : null,
      valorisation,
      traitementThermique: l.traitementThermique,
    }
  })

  const visibles = inclureEcoules ? data : data.filter((l) => l.etat !== 'ecoule' && l.stockPieces > 0)

  const stats = {
    nbLots: visibles.length,
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
