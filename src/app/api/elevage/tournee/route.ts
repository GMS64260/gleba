import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const completeSchema = z.object({
  tacheId: z.string().min(1),
  dateEcheance: z.coerce.date(),
  dateRealisation: z.coerce.date().optional(),
  notes: z.string().max(2000).nullable().optional(),
  clientOperationId: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const jours = Math.min(14, Math.max(0, Number(new URL(request.url).searchParams.get('jours') || 1)))
  const horizon = new Date(Date.now() + jours * 86_400_000)
  const data = await prisma.tacheTerrainElevage.findMany({
    where: { userId: session.user.id, actif: true, prochaineEcheance: { lte: horizon } },
    orderBy: [{ prochaineEcheance: 'asc' }, { priorite: 'desc' }],
  })
  return NextResponse.json({ data, generatedAt: new Date().toISOString() })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const parsed = completeSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data
  const existingOperation = await prisma.realisationTacheElevage.findFirst({
    where: { userId: session.user.id, clientOperationId: d.clientOperationId },
  })
  if (existingOperation) return NextResponse.json({ data: existingOperation, duplicate: true })

  const tache = await prisma.tacheTerrainElevage.findFirst({ where: { id: d.tacheId, userId: session.user.id, actif: true } })
  if (!tache) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
  if (tache.prochaineEcheance.getTime() !== d.dateEcheance.getTime()) {
    return NextResponse.json({ error: 'Cette occurrence a déjà été traitée ou déplacée', code: 'STALE_OCCURRENCE' }, { status: 409 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const realisation = await tx.realisationTacheElevage.create({
      data: { userId: session.user.id, tacheId: tache.id, dateEcheance: d.dateEcheance, dateRealisation: d.dateRealisation ?? new Date(), notes: d.notes ?? null, clientOperationId: d.clientOperationId },
    })
    if (tache.recurrenceJours) {
      let prochaine = new Date(tache.prochaineEcheance.getTime() + tache.recurrenceJours * 86_400_000)
      while (prochaine <= new Date()) prochaine = new Date(prochaine.getTime() + tache.recurrenceJours * 86_400_000)
      await tx.tacheTerrainElevage.update({ where: { id: tache.id }, data: { prochaineEcheance: prochaine } })
    } else {
      await tx.tacheTerrainElevage.update({ where: { id: tache.id }, data: { actif: false } })
    }
    return realisation
  })
  return NextResponse.json({ data: result })
}
