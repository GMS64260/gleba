/**
 * API Livraisons de lait à la laiterie (PROMPT 26).
 * GET ?annee= / POST / DELETE?id=
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { livraisonLaitSchema } from '@/lib/validations/livraison-lait'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const annee = searchParams.get('annee')
  const where: { userId: string; date?: { gte: Date; lte: Date } } = { userId: session.user.id }
  if (annee) {
    const a = parseInt(annee, 10)
    where.date = { gte: new Date(a, 0, 1), lte: new Date(a, 11, 31, 23, 59, 59) }
  }
  const livraisons = await prisma.livraisonLait.findMany({ where, orderBy: { date: 'desc' } })
  const litresTotal = livraisons.reduce((s, l) => s + Number(l.litres), 0)
  return NextResponse.json({
    data: livraisons,
    stats: { nb: livraisons.length, litresTotal: Math.round(litresTotal * 100) / 100 },
  })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const parsed = livraisonLaitSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const livraison = await prisma.livraisonLait.create({
      data: {
        userId: session.user.id,
        date: d.date,
        litres: d.litres,
        laiterie: d.laiterie ?? null,
        tb: d.tb ?? null,
        tp: d.tp ?? null,
        cellules: d.cellules ?? null,
        germes: d.germes ?? null,
        lipolyse: d.lipolyse ?? null,
        notes: d.notes ?? null,
      },
    })
    return NextResponse.json({ data: livraison }, { status: 201 })
  } catch (err) {
    console.error('POST /api/elevage/livraisons-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const existing = await prisma.livraisonLait.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Livraison introuvable' }, { status: 404 })
  await prisma.livraisonLait.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
