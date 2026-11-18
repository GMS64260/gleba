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
import { Prisma } from '@prisma/client'
import { creerMouvementCheptel, ErreurMouvementCheptel, mouvementSchema, recalerPosition, verrouillerCible } from '@/lib/elevage/creation-mouvement-cheptel'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const animalId = searchParams.get('animalId')
  const lotId = searchParams.get('lotId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Prisma.MouvementCheptelWhereInput = { userId: session.user.id }
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

    // Appartenance des ressources, journal et emplacement courant forment une
    // seule opération, partagée avec l'assistant : une erreur ne laisse jamais
    // la carte et l'historique en désaccord.
    const m = await prisma.$transaction((tx) => creerMouvementCheptel(tx, userId, d))

    return NextResponse.json({ data: m }, { status: 201 })
  } catch (err) {
    if (err instanceof ErreurMouvementCheptel) return NextResponse.json({ error: err.message }, { status: err.status })
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
    const cible = { animalId: existing.animalId, lotId: existing.lotId }
    await verrouillerCible(tx, session.user.id, cible)
    await tx.mouvementCheptel.delete({ where: { id } })
    // Sans mouvement restant, la bête retourne d'où ce mouvement l'avait sortie
    // (ELEV-05) : la parcelle d'origine est enregistrée, elle n'est pas perdue.
    await recalerPosition(tx, session.user.id, cible, existing.parcelleAvantId)
  })
  return NextResponse.json({ success: true })
}
