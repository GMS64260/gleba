/**
 * API Pedigree / cotation (Phase 1 — filières compagnie/équin).
 * n° LOF/LOOF, cotation SCC 1-6, confirmation, titres d'expo. 1 par animal.
 * GET ?animalId=  · PUT (upsert) — scopé userId, appartenance animal validée.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  const animalId = new URL(request.url).searchParams.get('animalId')
  if (!animalId) return NextResponse.json({ error: 'animalId requis' }, { status: 400 })
  const data = await prisma.pedigreeElevage.findFirst({ where: { userId, animalId: Number(animalId) } })
  return NextResponse.json({ data })
}

export async function PUT(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  try {
    const b = await request.json()
    if (b?.animalId == null) return NextResponse.json({ error: 'animalId requis' }, { status: 400 })
    const animalId = Number(b.animalId)
    const animal = await prisma.animal.findFirst({ where: { id: animalId, userId }, select: { id: true } })
    if (!animal) return NextResponse.json({ error: 'Animal introuvable' }, { status: 400 })
    const cotation = b.cotation != null && b.cotation !== '' ? Math.min(6, Math.max(1, Number(b.cotation))) : null
    const payload = {
      numeroLof: b.numeroLof || null,
      cotation,
      confirmationLof: !!b.confirmationLof,
      dateConfirmation: b.dateConfirmation ? new Date(b.dateConfirmation) : null,
      titres: b.titres || null,
    }
    const data = await prisma.pedigreeElevage.upsert({
      where: { animalId },
      update: payload,
      create: { userId, animalId, ...payload },
    })
    return NextResponse.json({ data })
  } catch (e) {
    console.error('PUT /api/elevage/pedigree', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
