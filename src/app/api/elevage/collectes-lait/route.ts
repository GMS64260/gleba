/**
 * API Collectes de lait (PROMPT 17).
 *
 * GET    ?from=YYYY-MM-DD&to=YYYY-MM-DD&animalId=&lotId=
 *        → liste, agrégée par jour×traite si besoin
 * POST   crée une collecte (animal OU lot)
 * PATCH  modifie une collecte
 * DELETE id=
 *
 * Contrainte d'unicité : (user, date, traite, animal, lot) — saisir 2 fois
 * la traite du matin d'un même animal écrase la première en upsert.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { collecteLaitSchema, updateCollecteLaitSchema } from '@/lib/validations/lait'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const animalId = searchParams.get('animalId')
  const lotId = searchParams.get('lotId')

  const where: any = { userId: session.user.id }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }
  if (animalId) where.animalId = parseInt(animalId, 10)
  if (lotId) where.lotId = parseInt(lotId, 10)

  const collectes = await prisma.collecteLait.findMany({
    where,
    orderBy: [{ date: 'desc' }, { traite: 'asc' }],
    include: {
      animal: { select: { id: true, identifiant: true, nom: true } },
      lot: { select: { id: true, nom: true } },
      lotFromage: { select: { id: true, numeroLot: true, typeFromage: true } },
    },
  })

  // Agrégats utiles
  const stats = {
    nbCollectes: collectes.length,
    totalLitres: collectes.reduce((s, c) => s + Number(c.quantiteLitres), 0),
    litresAffectes: collectes.filter((c) => c.lotFromageId).reduce((s, c) => s + Number(c.quantiteLitres), 0),
    litresEcartes: collectes.filter((c) => c.ecarteAttente).reduce((s, c) => s + Number(c.quantiteLitres), 0),
  }

  return NextResponse.json({ data: collectes, stats })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = collecteLaitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    // Normalise la date au jour (00:00 UTC)
    const day = new Date(data.date)
    day.setUTCHours(0, 0, 0, 0)

    // Upsert pour permettre "saisie identique à hier" / corrections
    const existing = await prisma.collecteLait.findFirst({
      where: {
        userId: session.user.id,
        date: day,
        traite: data.traite,
        animalId: data.animalId ?? null,
        lotId: data.lotId ?? null,
      },
    })

    const payload = {
      userId: session.user.id,
      date: day,
      traite: data.traite,
      animalId: data.animalId ?? null,
      lotId: data.lotId ?? null,
      quantiteLitres: data.quantiteLitres,
      mgGpl: data.mgGpl ?? null,
      mpGpl: data.mpGpl ?? null,
      cellulesParMl: data.cellulesParMl ?? null,
      temperatureC: data.temperatureC ?? null,
      ecarteAttente: data.ecarteAttente ?? false,
      notes: data.notes ?? null,
      lotFromageId: data.lotFromageId ?? null,
    }

    const collecte = existing
      ? await prisma.collecteLait.update({ where: { id: existing.id }, data: payload })
      : await prisma.collecteLait.create({ data: payload })

    return NextResponse.json({ data: collecte }, { status: existing ? 200 : 201 })
  } catch (err) {
    console.error('POST /api/elevage/collectes-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = updateCollecteLaitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, ...updates } = parsed.data
    const existing = await prisma.collecteLait.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: 'Collecte non trouvée' }, { status: 404 })

    const collecte = await prisma.collecteLait.update({ where: { id }, data: updates })
    return NextResponse.json({ data: collecte })
  } catch (err) {
    console.error('PATCH /api/elevage/collectes-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const existing = await prisma.collecteLait.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Collecte non trouvée' }, { status: 404 })

  // Refus si déjà affectée à un lot fromage (intégrité traçabilité)
  if (existing.lotFromageId) {
    return NextResponse.json(
      { error: 'Cette collecte est affectée à un lot fromage. Désaffectez-la d\'abord.' },
      { status: 409 }
    )
  }

  await prisma.collecteLait.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
