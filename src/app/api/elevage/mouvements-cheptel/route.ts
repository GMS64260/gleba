/**
 * API Mouvements de cheptel (PROMPT 19A §4).
 *
 * GET   ?animalId=&lotId=&from=&to=
 * POST  enregistre un déplacement
 * DELETE id=
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const mouvementSchema = z
  .object({
    animalId: z.coerce.number().int().positive().nullable().optional(),
    lotId: z.coerce.number().int().positive().nullable().optional(),
    parcelleAvantId: z.string().nullable().optional(),
    parcelleApresId: z.string().nullable().optional(),
    date: z.coerce.date(),
    motif: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => d.animalId || d.lotId, { message: 'Renseignez animalId ou lotId.' })

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const animalId = searchParams.get('animalId')
  const lotId = searchParams.get('lotId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: any = { userId: session.user.id }
  if (animalId) where.animalId = parseInt(animalId, 10)
  if (lotId) where.lotId = parseInt(lotId, 10)
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const mouvements = await prisma.mouvementCheptel.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      animal: { select: { id: true, nom: true, identifiant: true } },
      lot: { select: { id: true, nom: true } },
      parcelleAvant: { select: { id: true, nom: true } },
      parcelleApres: { select: { id: true, nom: true } },
    },
  })

  return NextResponse.json({ data: mouvements })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = mouvementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data

    const m = await prisma.mouvementCheptel.create({
      data: {
        userId: session.user.id,
        animalId: d.animalId ?? null,
        lotId: d.lotId ?? null,
        parcelleAvantId: d.parcelleAvantId ?? null,
        parcelleApresId: d.parcelleApresId ?? null,
        date: d.date,
        motif: d.motif ?? null,
        notes: d.notes ?? null,
      },
    })

    // Mise à jour optionnelle de la parcelle courante du lot (vu LotAnimaux.parcelleGeoId)
    if (d.lotId && d.parcelleApresId) {
      await prisma.lotAnimaux.update({
        where: { id: d.lotId },
        data: { parcelleGeoId: d.parcelleApresId },
      })
    }

    return NextResponse.json({ data: m }, { status: 201 })
  } catch (err) {
    console.error('POST /api/elevage/mouvements-cheptel error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const existing = await prisma.mouvementCheptel.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Mouvement non trouvé' }, { status: 404 })

  await prisma.mouvementCheptel.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
