import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import { getActeurId } from '@/lib/exploitation/garde-session'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
  // Portée du cache hors connexion (revue Codex SEC-02) : la personne connectée
  // et l'exploitation lue. Le navigateur ne rattache ses tâches et sa file qu'à
  // cette portée, jamais à un autre compte.
  const portee = { acteurId: getActeurId(session), proprietaireId: session.user.id }
  return NextResponse.json({ data, portee, generatedAt: new Date().toISOString() })
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

  // Tâche lue sans filtre `actif` : une tâche ponctuelle déjà réalisée est
  // inactive, et c'est un « déjà traité » (409, que le navigateur retire de sa
  // file), pas une tâche introuvable (D92 : l'opération rejouée restait en file).
  const tache = await prisma.tacheTerrainElevage.findFirst({ where: { id: d.tacheId, userId: session.user.id } })
  if (!tache) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
  const dejaTraitee = () =>
    NextResponse.json({ error: 'Cette occurrence a déjà été traitée ou déplacée', code: 'STALE_OCCURRENCE' }, { status: 409 })
  if (!tache.actif) {
    // Inactive parce que réalisée : déjà traité. Inactive parce que supprimée :
    // refus définitif, que le navigateur annonce au lieu de le compter envoyé.
    const realisee = await prisma.realisationTacheElevage.findFirst({
      where: { userId: session.user.id, tacheId: tache.id, dateEcheance: d.dateEcheance },
      select: { id: true },
    })
    return realisee
      ? dejaTraitee()
      : NextResponse.json({ error: 'Cette tâche a été supprimée', code: 'TACHE_RETIREE' }, { status: 410 })
  }
  if (tache.prochaineEcheance.getTime() !== d.dateEcheance.getTime()) return dejaTraitee()

  const userId = session.user.id
  let result
  try {
    result = await enregistrerRealisation(tache)
  } catch (e) {
    // Deux envois simultanés de la même occurrence : l'unicité (tâche,
    // échéance) ou celle de l'opération refuse le second.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return dejaTraitee()
    throw e
  }
  return NextResponse.json({ data: result })

  function enregistrerRealisation(tache: { id: string; prochaineEcheance: Date; recurrenceJours: number | null }) {
   return prisma.$transaction(async (tx) => {
    const realisation = await tx.realisationTacheElevage.create({
      data: { userId, tacheId: tache.id, dateEcheance: d.dateEcheance, dateRealisation: d.dateRealisation ?? new Date(), notes: d.notes ?? null, clientOperationId: d.clientOperationId },
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
  }
}
