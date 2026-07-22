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
  .refine((d) => Boolean(d.animalId) !== Boolean(d.lotId), {
    message: 'Renseignez un animal ou un lot, pas les deux.',
  })

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
    const userId = session.user.id

    // POSTREVIEW Sprint 5 — Validation tenant : chaque ressource référencée
    // doit appartenir au user authentifié (avant : IDOR exploitable trivialement)
    if (d.animalId) {
      const a = await prisma.animal.findFirst({ where: { id: d.animalId, userId }, select: { id: true } })
      if (!a) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
    }
    if (d.lotId) {
      const l = await prisma.lotAnimaux.findFirst({ where: { id: d.lotId, userId }, select: { id: true } })
      if (!l) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }
    if (d.parcelleAvantId) {
      const p = await prisma.parcelleGeo.findFirst({ where: { id: d.parcelleAvantId, userId }, select: { id: true } })
      if (!p) return NextResponse.json({ error: 'Parcelle origine introuvable' }, { status: 404 })
    }
    if (d.parcelleApresId) {
      const p = await prisma.parcelleGeo.findFirst({ where: { id: d.parcelleApresId, userId }, select: { id: true } })
      if (!p) return NextResponse.json({ error: 'Parcelle destination introuvable' }, { status: 404 })
    }

    // Le journal et l'emplacement courant forment une seule opération : une
    // erreur ne doit jamais laisser la carte et l'historique en désaccord.
    const m = await prisma.$transaction(async (tx) => {
      const mouvement = await tx.mouvementCheptel.create({
        data: {
          userId,
          animalId: d.animalId ?? null,
          lotId: d.lotId ?? null,
          parcelleAvantId: d.parcelleAvantId ?? null,
          parcelleApresId: d.parcelleApresId ?? null,
          date: d.date,
          motif: d.motif ?? null,
          notes: d.notes ?? null,
        },
      })

      if (d.lotId) {
        await tx.lotAnimaux.updateMany({
          where: { id: d.lotId, userId },
          data: { parcelleGeoId: d.parcelleApresId ?? null },
        })
      }
      if (d.animalId) {
        await tx.animal.updateMany({
          where: { id: d.animalId, userId },
          data: { parcelleGeoId: d.parcelleApresId ?? null },
        })
      }
      return mouvement
    })

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

  await prisma.$transaction(async (tx) => {
    await tx.mouvementCheptel.delete({ where: { id } })
    const precedent = await tx.mouvementCheptel.findFirst({
      where: {
        userId: session.user.id,
        ...(existing.animalId ? { animalId: existing.animalId } : { lotId: existing.lotId }),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { parcelleApresId: true },
    })
    if (existing.animalId) await tx.animal.updateMany({
      where: { id: existing.animalId, userId: session.user.id },
      data: { parcelleGeoId: precedent?.parcelleApresId ?? null },
    })
    if (existing.lotId) await tx.lotAnimaux.updateMany({
      where: { id: existing.lotId, userId: session.user.id },
      data: { parcelleGeoId: precedent?.parcelleApresId ?? null },
    })
  })
  return NextResponse.json({ success: true })
}
