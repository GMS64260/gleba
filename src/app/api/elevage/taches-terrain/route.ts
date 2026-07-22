import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const schema = z.object({
  id: z.string().optional(),
  titre: z.string().trim().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
  categorie: z.enum(['alimentation', 'traite', 'soin', 'reproduction', 'paturage', 'controle', 'autre']).default('autre'),
  priorite: z.enum(['basse', 'normale', 'haute', 'urgente']).default('normale'),
  animalId: z.coerce.number().int().positive().nullable().optional(),
  lotId: z.coerce.number().int().positive().nullable().optional(),
  prochaineEcheance: z.coerce.date(),
  recurrenceJours: z.coerce.number().int().min(1).max(366).nullable().optional(),
  actif: z.boolean().default(true),
}).refine((d) => !(d.animalId && d.lotId), { message: 'Ciblez un animal ou un lot, pas les deux.' })

async function cibleValide(userId: string, animalId?: number | null, lotId?: number | null) {
  if (animalId && !await prisma.animal.findFirst({ where: { id: animalId, userId }, select: { id: true } })) return false
  if (lotId && !await prisma.lotAnimaux.findFirst({ where: { id: lotId, userId }, select: { id: true } })) return false
  return true
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const inclureInactives = new URL(request.url).searchParams.get('toutes') === '1'
  const data = await prisma.tacheTerrainElevage.findMany({
    where: { userId: session.user.id, ...(inclureInactives ? {} : { actif: true }) },
    orderBy: [{ prochaineEcheance: 'asc' }, { priorite: 'desc' }],
  })
  return NextResponse.json({ data })
}

async function save(request: NextRequest, update: boolean) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const { id, ...d } = parsed.data
  if (!await cibleValide(session.user.id, d.animalId, d.lotId)) return NextResponse.json({ error: 'Animal ou lot introuvable' }, { status: 400 })
  if (update) {
    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    const found = await prisma.tacheTerrainElevage.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
    if (!found) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
    const data = await prisma.tacheTerrainElevage.update({ where: { id }, data: d })
    return NextResponse.json({ data })
  }
  const data = await prisma.tacheTerrainElevage.create({ data: { userId: session.user.id, ...d } })
  return NextResponse.json({ data }, { status: 201 })
}
export const POST = (request: NextRequest) => save(request, false)
export const PATCH = (request: NextRequest) => save(request, true)

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const result = await prisma.tacheTerrainElevage.updateMany({ where: { id, userId: session.user.id }, data: { actif: false } })
  if (!result.count) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
  return NextResponse.json({ success: true })
}
