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
    // Fin du jour de collecte (exclusif) pour comparer les soins À LA
    // GRANULARITÉ DU JOUR : un soin `fait` porte une date-heure complète
    // (ex. 13:00), or la collecte est normalisée à 00:00. Avec `date: { lte: day }`
    // un traitement de l'après-midi ne "couvrait" pas la traite du même jour →
    // le lait du jour du traitement partait en circulation (audit 2026-07 #17,
    // risque sanitaire). On écarte tout le jour du traitement (choix prudent).
    const jourSuivant = new Date(day)
    jourSuivant.setUTCDate(jourSuivant.getUTCDate() + 1)

    // Audit élevage 2026-06-11 — écartement automatique : le POST /soins
    // n'écarte que les collectes EXISTANTES à sa création ; une collecte
    // saisie ensuite dans la fenêtre d'attente passait en circulation.
    // On vérifie ici si un soin réalisé couvre la date de la collecte.
    const soinCouvrant = await prisma.soinAnimal.findFirst({
      where: {
        userId: session.user.id,
        fait: true,
        finAttenteLait: { gte: day },
        date: { lt: jourSuivant },
        ...(data.animalId ? { animalId: data.animalId } : { lotId: data.lotId }),
      },
      select: { id: true, finAttenteLait: true, produit: true, type: true },
    })
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
      const soinCouvrant = await prisma.soinAnimal.findFirst({
        where: {
          userId: session.user.id,
          fait: true,
          finAttenteLait: { gte: day },
          date: { lte: day },
          ...(existing.animalId ? { animalId: existing.animalId } : { lotId: existing.lotId }),
        },
        select: { id: true },
      })
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
