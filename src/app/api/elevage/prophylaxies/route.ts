import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const schema = z.object({
  id: z.string().optional(),
  especeAnimaleId: z.string().nullable().optional(),
  type: z.string().trim().min(1).max(200),
  datePrevue: z.coerce.date(),
  dateRealisee: z.coerce.date().nullable().optional(),
  statut: z.enum(['a_faire', 'realisee', 'annulee']).default('a_faire'),
  organisme: z.string().max(200).nullable().optional(),
  resultat: z.string().max(1000).nullable().optional(),
  documentUrl: z.string().url().nullable().optional().or(z.literal('')),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const data = await prisma.prophylaxieElevage.findMany({
    where: { userId: session.user.id }, orderBy: { datePrevue: 'desc' },
  })
  return NextResponse.json({ data })
}

async function save(request: NextRequest, update: boolean) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const { id, ...d } = parsed.data
  if (d.especeAnimaleId) {
    const espece = await prisma.especeAnimale.findFirst({
      where: { id: d.especeAnimaleId, OR: [{ userId: null }, { userId: session.user.id }] }, select: { id: true },
    })
    if (!espece) return NextResponse.json({ error: 'Espèce introuvable' }, { status: 400 })
  }
  if (update) {
    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    const found = await prisma.prophylaxieElevage.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
    if (!found) return NextResponse.json({ error: 'Échéance introuvable' }, { status: 404 })
    const data = await prisma.prophylaxieElevage.update({ where: { id }, data: { ...d, documentUrl: d.documentUrl || null } })
    return NextResponse.json({ data })
  }
  const data = await prisma.prophylaxieElevage.create({ data: { userId: session.user.id, ...d, documentUrl: d.documentUrl || null } })
  return NextResponse.json({ data }, { status: 201 })
}

export const POST = (request: NextRequest) => save(request, false)
export const PATCH = (request: NextRequest) => save(request, true)

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const result = await prisma.prophylaxieElevage.deleteMany({ where: { id, userId: session.user.id } })
  if (!result.count) return NextResponse.json({ error: 'Échéance introuvable' }, { status: 404 })
  return NextResponse.json({ success: true })
}
