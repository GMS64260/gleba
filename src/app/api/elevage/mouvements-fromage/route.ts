/**
 * API Mouvements de stock fromage / sorties de cave (PROMPT 27).
 * GET ?lotId= / POST / DELETE?id=
 * Contrôle que la sortie ne dépasse pas le stock restant du lot.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { StockFromageError, verrouillerEtVerifierStockFromage } from '@/lib/elevage/stock-fromage'

const TYPES = ['sortie_vente', 'sortie_perte', 'sortie_don', 'ajustement'] as const

const schema = z.object({
  lotFromageId: z.string().min(1),
  date: z.coerce.date(),
  type: z.enum(TYPES),
  nbPieces: z.coerce.number().int().min(0).default(0),
  poidsKg: z.coerce.number().min(0).default(0),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const lotId = searchParams.get('lotId')
  const where: { userId: string; lotFromageId?: string } = { userId: session.user.id }
  if (lotId) where.lotFromageId = lotId
  const mouvements = await prisma.mouvementFromage.findMany({ where, orderBy: { date: 'desc' } })
  return NextResponse.json({ data: mouvements })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const mouvementKg = Number(d.poidsKg) || 0
    const mouvement = await prisma.$transaction(async (tx) => {
      const { lot, sortiPieces, sortiKg } = d.type === 'ajustement'
        ? {
            lot: await tx.lotFromage.findFirst({ where: { id: d.lotFromageId, userId: session.user.id } }),
            sortiPieces: 0,
            sortiKg: 0,
          }
        : await verrouillerEtVerifierStockFromage(tx, session.user.id, d.lotFromageId, d.nbPieces, mouvementKg)
      if (!lot) throw new StockFromageError('Lot introuvable', 404)

      const saved = await tx.mouvementFromage.create({ data: {
        userId: session.user.id,
        lotFromageId: d.lotFromageId,
        date: d.date,
        type: d.type,
        nbPieces: d.nbPieces,
        poidsKg: d.poidsKg,
        notes: d.notes ?? null,
      } })

      const totalSortiPieces = sortiPieces + d.nbPieces
      const totalSortiKg = sortiKg + mouvementKg
      if (d.type !== 'ajustement' && (totalSortiPieces >= lot.nbPieces || totalSortiKg >= Number(lot.poidsTotalKg) - 1e-6)) {
        await tx.lotFromage.update({ where: { id: lot.id }, data: { etat: 'ecoule' } })
      }
      return saved
    })

    return NextResponse.json({ data: mouvement }, { status: 201 })
  } catch (err) {
    if (err instanceof StockFromageError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('POST /api/elevage/mouvements-fromage error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const existing = await prisma.mouvementFromage.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Mouvement introuvable' }, { status: 404 })
  await prisma.mouvementFromage.delete({ where: { id } })

  // Revue élevage 2026-07-21 — recalcul de l'état : supprimer la sortie qui avait
  // épuisé un lot doit le sortir de 'ecoule' (sinon il disparaît de l'inventaire).
  const lot = await prisma.lotFromage.findFirst({
    where: { id: existing.lotFromageId, userId: session.user.id },
    include: { mouvements: { select: { nbPieces: true, poidsKg: true } } },
  })
  if (lot && lot.etat === 'ecoule') {
    const sortiesPieces = lot.mouvements.reduce((s, m) => s + m.nbPieces, 0)
    const sortiesKg = lot.mouvements.reduce((s, m) => s + (Number(m.poidsKg) || 0), 0)
    if (sortiesPieces < lot.nbPieces && sortiesKg < Number(lot.poidsTotalKg) - 1e-6) {
      await prisma.lotFromage.update({ where: { id: lot.id }, data: { etat: 'pret' } })
    }
  }

  return NextResponse.json({ success: true })
}
