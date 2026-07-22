import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const schema = z.object({
  produitId: z.string().min(1),
  numeroLot: z.string().trim().min(1).max(100),
  quantite: z.coerce.number().min(0),
  unite: z.string().trim().min(1).max(30),
  datePeremption: z.coerce.date().nullable().optional(),
  ordonnanceUrl: z.string().url().nullable().optional().or(z.literal('')),
  fournisseur: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const data = await prisma.stockMedicamentElevage.findMany({
    where: { userId: session.user.id }, orderBy: [{ datePeremption: 'asc' }, { updatedAt: 'desc' }],
  })
  const produits = await prisma.produitVeterinaire.findMany({
    where: { id: { in: [...new Set(data.map((s) => s.produitId))] } },
    select: { id: true, nom: true, amm: true },
  })
  const noms = new Map(produits.map((p) => [p.id, p]))
  return NextResponse.json({ data: data.map((s) => ({ ...s, produit: noms.get(s.produitId) ?? null })) })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data
  const produit = await prisma.produitVeterinaire.findUnique({ where: { id: d.produitId }, select: { id: true } })
  if (!produit) return NextResponse.json({ error: 'Produit vétérinaire introuvable' }, { status: 400 })
  const data = await prisma.stockMedicamentElevage.upsert({
    where: { userId_produitId_numeroLot: { userId: session.user.id, produitId: d.produitId, numeroLot: d.numeroLot } },
    create: { userId: session.user.id, ...d, ordonnanceUrl: d.ordonnanceUrl || null },
    update: { ...d, ordonnanceUrl: d.ordonnanceUrl || null },
  })
  return NextResponse.json({ data }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const result = await prisma.stockMedicamentElevage.deleteMany({ where: { id, userId: session.user.id } })
  if (!result.count) return NextResponse.json({ error: 'Stock introuvable' }, { status: 404 })
  return NextResponse.json({ success: true })
}
