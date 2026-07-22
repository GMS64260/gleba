/**
 * API Pesées (GAP P1 — historique de poids & GMQ, review caprin 2026-07-22).
 * GET ?animalId=  → historique + GMQ ; POST ; DELETE?id=
 * Le poids était jusqu'ici un champ unique écrasé (Animal.poidsActuel) → aucune
 * courbe de croissance. On historise, on calcule le GMQ (gain moyen quotidien)
 * entre pesées, et on maintient Animal.poidsActuel = dernière pesée.
 * Scopé userId ; appartenance de l'animal validée à l'écriture.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

const schema = z.object({
  animalId: z.coerce.number().int().positive(),
  date: z.coerce.date(),
  poidsKg: z.coerce.number().positive('Le poids doit être positif'),
  notes: z.string().max(1000).nullable().optional(),
})

async function animalPossede(userId: string, animalId: number): Promise<boolean> {
  const a = await prisma.animal.findFirst({ where: { id: animalId, userId }, select: { id: true } })
  return !!a
}

// Recale Animal.poidsActuel sur la pesée la plus récente (ou null si plus aucune).
async function majPoidsActuel(tx: Prisma.TransactionClient, userId: string, animalId: number) {
  const derniere = await tx.pesee.findFirst({
    where: { userId, animalId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { poidsKg: true },
  })
  await tx.animal.updateMany({
    where: { id: animalId, userId },
    data: { poidsActuel: derniere ? derniere.poidsKg : null },
  })
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const animalIdStr = searchParams.get('animalId')
  if (!animalIdStr) return NextResponse.json({ error: 'animalId requis' }, { status: 400 })
  const animalId = parseInt(animalIdStr, 10)
  if (!(await animalPossede(session.user.id, animalId))) {
    return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
  }

  const pesees = await prisma.pesee.findMany({
    where: { userId: session.user.id, animalId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, date: true, poidsKg: true, notes: true },
  })

  // GMQ (g/jour) de chaque pesée vs la précédente.
  const data = pesees.map((p, i) => {
    let gmq: number | null = null
    if (i > 0) {
      const prev = pesees[i - 1]
      const jours = (p.date.getTime() - prev.date.getTime()) / 86_400_000
      if (jours > 0) gmq = Math.round(((p.poidsKg - prev.poidsKg) / jours) * 1000)
    }
    return { id: p.id, date: p.date.toISOString(), poidsKg: p.poidsKg, notes: p.notes, gmq }
  })

  // GMQ global (première → dernière pesée).
  let gmqGlobal: number | null = null
  if (pesees.length >= 2) {
    const first = pesees[0]
    const last = pesees[pesees.length - 1]
    const jours = (last.date.getTime() - first.date.getTime()) / 86_400_000
    if (jours > 0) gmqGlobal = Math.round(((last.poidsKg - first.poidsKg) / jours) * 1000)
  }

  return NextResponse.json({ data, gmqGlobal, nb: pesees.length })
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
    if (!(await animalPossede(session.user.id, d.animalId))) {
      return NextResponse.json({ error: 'Animal introuvable dans votre cheptel.' }, { status: 400 })
    }
    const pesee = await prisma.$transaction(async (tx) => {
      const saved = await tx.pesee.create({
        data: { userId: session.user.id, animalId: d.animalId, date: d.date, poidsKg: d.poidsKg, notes: d.notes ?? null },
      })
      await majPoidsActuel(tx, session.user.id, d.animalId)
      return saved
    })
    return NextResponse.json({ data: pesee }, { status: 201 })
  } catch (err) {
    console.error('POST /api/elevage/pesees error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const existing = await prisma.pesee.findFirst({ where: { id, userId: session.user.id }, select: { id: true, animalId: true } })
  if (!existing) return NextResponse.json({ error: 'Pesée introuvable' }, { status: 404 })
  await prisma.$transaction(async (tx) => {
    await tx.pesee.delete({ where: { id } })
    await majPoidsActuel(tx, session.user.id, existing.animalId)
  })
  return NextResponse.json({ success: true })
}
