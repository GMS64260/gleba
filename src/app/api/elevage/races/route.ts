/**
 * API — Référentiel des races animales (partagé, communautaire).
 * GET    /api/elevage/races[?especeAnimaleId=&avis=1] — liste (+ stats d'avis)
 * POST   /api/elevage/races                           — créer une race
 * DELETE /api/elevage/races?id=<id>                   — supprimer (+ ses avis)
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'
import { statsAvisPourRefs } from '@/lib/avis/stats-liste'

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const especeAnimaleId = searchParams.get('especeAnimaleId')
  const includeAvis = searchParams.get('avis') === '1'

  const races = await prisma.raceAnimale.findMany({
    where: especeAnimaleId ? { especeAnimaleId } : undefined,
    include: { especeAnimale: { select: { id: true, nom: true } } },
    orderBy: [{ especeAnimaleId: 'asc' }, { nom: 'asc' }],
  })

  const statsMap = includeAvis ? await statsAvisPourRefs(prisma, 'RACE', races.map((r) => r.id)) : null
  const data = statsMap ? races.map((r) => ({ ...r, avisStats: statsMap.get(r.id) })) : races

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const body = await request.json()
    const nom = String(body.nom || '').trim()
    const especeAnimaleId = String(body.especeAnimaleId || '').trim()
    if (!nom || !especeAnimaleId) {
      return NextResponse.json({ error: 'Nom et espèce requis' }, { status: 400 })
    }
    const espece = await prisma.especeAnimale.findUnique({ where: { id: especeAnimaleId }, select: { id: true } })
    if (!espece) return NextResponse.json({ error: 'Espèce introuvable' }, { status: 400 })

    const race = await prisma.raceAnimale.create({
      data: {
        nom,
        especeAnimaleId,
        origine: body.origine || null,
        aptitudes: Array.isArray(body.aptitudes) ? body.aptitudes : [],
        rusticite: typeof body.rusticite === 'number' ? body.rusticite : null,
        description: body.description || null,
      },
    })
    return NextResponse.json({ data: race }, { status: 201 })
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Cette race existe déjà pour cette espèce' }, { status: 409 })
    }
    console.error('POST /api/elevage/races error:', err)
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  // Nettoyage best-effort des avis liés (pas de FK polymorphe).
  await prisma.avis.deleteMany({ where: { refType: 'RACE', refId: id } })
  await prisma.raceAnimale.delete({ where: { id } })
  return NextResponse.json({ data: { ok: true } })
}
