/**
 * Vérification consanguinité entre une femelle et un mâle candidats.
 * GET /api/elevage/consanguinite?femelleId=10&maleId=20&generations=3
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { detecterConsanguinite } from '@/lib/reproduction'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const femelleId = parseInt(searchParams.get('femelleId') || '0', 10)
  const maleId = parseInt(searchParams.get('maleId') || '0', 10)
  const generations = parseInt(searchParams.get('generations') || '3', 10)
  if (!femelleId || !maleId) return NextResponse.json({ error: 'femelleId et maleId requis' }, { status: 400 })

  const [f, m] = await Promise.all([
    prisma.animal.findFirst({ where: { id: femelleId, userId: session.user.id }, select: { id: true } }),
    prisma.animal.findFirst({ where: { id: maleId, userId: session.user.id }, select: { id: true } }),
  ])
  if (!f || !m) return NextResponse.json({ error: 'Animaux non trouvés' }, { status: 404 })

  const ancetresCommuns = await detecterConsanguinite(prisma, femelleId, maleId, generations)
  return NextResponse.json({
    consanguinite: ancetresCommuns.length > 0,
    generations,
    ancetresCommuns,
  })
}
