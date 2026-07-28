/**
 * API Tests santé / génétiques d'élevage (Phase 1 — filières compagnie/équin).
 * Dysplasie (A-E, coude 0-3), tares oculaires, panels ADN, ADN de filiation ISAG.
 * GET / POST / DELETE — scopé userId, appartenance animal validée à l'écriture.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { estTypeTestSante } from '@/lib/elevage/tests-sante'

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  try {
    const animalId = new URL(request.url).searchParams.get('animalId')
    const where: { userId: string; animalId?: number } = { userId }
    if (animalId) where.animalId = Number(animalId)
    const data = await prisma.testSanteElevage.findMany({ where, orderBy: { date: 'desc' } })
    return NextResponse.json({ data })
  } catch (e) {
    console.error('GET /api/elevage/tests-sante', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  try {
    const b = await request.json()
    if (b?.animalId == null || !b?.type) {
      return NextResponse.json({ error: 'animalId et type requis' }, { status: 400 })
    }
    if (!estTypeTestSante(b.type)) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
    // Appartenance de l'animal.
    const animal = await prisma.animal.findFirst({ where: { id: Number(b.animalId), userId }, select: { id: true } })
    if (!animal) return NextResponse.json({ error: 'Animal introuvable' }, { status: 400 })
    const data = await prisma.testSanteElevage.create({
      data: {
        userId,
        animalId: Number(b.animalId),
        type: b.type,
        resultat: b.resultat || null,
        laboratoire: b.laboratoire || null,
        reference: b.reference || null,
        date: b.date ? new Date(b.date) : null,
        notes: b.notes || null,
      },
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    console.error('POST /api/elevage/tests-sante', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })
    const existing = await prisma.testSanteElevage.findFirst({ where: { id, userId }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Test introuvable' }, { status: 404 })
    await prisma.testSanteElevage.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE /api/elevage/tests-sante', e)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
