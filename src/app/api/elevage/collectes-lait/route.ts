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
import { soinCouvrantCollecte } from '@/lib/elevage/attente-lait'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const animalId = searchParams.get('animalId')
  const lotId = searchParams.get('lotId')
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : undefined

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
    take: limit,
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

    // Audit élevage 2026-06-11 — validation tenant : l'animal/le lot
    // référencé doit appartenir au user (même règle que mouvements-cheptel).
    if (data.animalId) {
      const a = await prisma.animal.findFirst({
        where: { id: data.animalId, userId: session.user.id },
        select: { id: true },
      })
      if (!a) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
    }
    if (data.lotId) {
      const l = await prisma.lotAnimaux.findFirst({
        where: { id: data.lotId, userId: session.user.id },
        select: { id: true },
      })
      if (!l) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Normalise la date au jour (00:00 UTC)
    const day = new Date(data.date)
    day.setUTCHours(0, 0, 0, 0)
    // Écartement automatique CROSS-GRANULARITÉ (review caprin 2026-07-22) :
    // une collecte saisie dans la fenêtre d'attente d'un soin est écartée, que
    // le soin porte sur le MÊME animal/lot OU sur l'animal↔son lot (soin de lot
    // → collecte individuelle d'un membre, et inversement). Comparaison au jour
    // (collecte à 00:00, soin horodaté). Cf. lib attente-lait.
    const soinCouvrant = await soinCouvrantCollecte(prisma, session.user.id, data.animalId ?? null, data.lotId ?? null, day)
    const ecarte = (data.ecarteAttente ?? false) || soinCouvrant !== null

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
      ecarteAttente: ecarte,
      notes: data.notes ?? null,
      lotFromageId: data.lotFromageId ?? null,
    }

    const collecte = existing
      ? await prisma.collecteLait.update({ where: { id: existing.id }, data: payload })
      : await prisma.collecteLait.create({ data: payload })

    return NextResponse.json(
      {
        data: collecte,
        info: soinCouvrant && !data.ecarteAttente
          ? `Collecte écartée automatiquement : traitement « ${soinCouvrant.produit || soinCouvrant.type} » en temps d'attente lait jusqu'au ${soinCouvrant.finAttenteLait?.toLocaleDateString('fr-FR')}.`
          : null,
      },
      { status: existing ? 200 : 201 }
    )
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

    // Audit élevage 2026-06-11 — si la date change sans consigne explicite
    // d'écartement, on réévalue la fenêtre d'attente à la nouvelle date
    // (sinon déplacer une collecte hors/dans une fenêtre gardait l'ancien flag).
    const data: typeof updates & { ecarteAttente?: boolean } = { ...updates }
    if (updates.date && updates.ecarteAttente === undefined && (existing.animalId || existing.lotId)) {
      const day = new Date(updates.date)
      day.setUTCHours(0, 0, 0, 0)
      // Cross-granularité + comparaison au jour (cf. lib attente-lait).
      const soinCouvrant = await soinCouvrantCollecte(prisma, session.user.id, existing.animalId, existing.lotId, day)
      data.ecarteAttente = soinCouvrant !== null
    }

    const collecte = await prisma.collecteLait.update({ where: { id }, data })
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
