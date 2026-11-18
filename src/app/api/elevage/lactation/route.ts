/**
 * Courbe de lactation 305 jours pour un animal donné.
 * GET /api/elevage/lactation?animalId=42
 *
 * Stratégie : dernière mise-bas connue = origine du DIM (Days In Milk).
 * Sans mise-bas, la première collecte disponible dans les 305 derniers jours
 * donne une origine estimée, sans suggestion de tarissement.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { projeterLactation } from '@/lib/elevage/lactation-origine'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const animalIdStr = searchParams.get('animalId')
  if (!animalIdStr) return NextResponse.json({ error: 'animalId requis' }, { status: 400 })
  const animalId = parseInt(animalIdStr, 10)

  const animal = await prisma.animal.findFirst({
    where: { id: animalId, userId: session.user.id },
    include: {
      naissancesMere: { orderBy: { date: 'desc' }, take: 1 },
    },
  })
  if (!animal) return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
  // PROMPT 24 — lactation longue : la chèvre est traite sans tarissement prévu
  const lactationLongue = animal.lactationLongue === true

  const derniereMiseBas = animal.naissancesMere[0]?.date

  // Cherche les collectes depuis la mise-bas (ou les 305 derniers jours)
  const since = derniereMiseBas ?? new Date(Date.now() - 305 * 86_400_000)

  const collectes = await prisma.collecteLait.findMany({
    where: { animalId, userId: session.user.id, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: { date: true, quantiteLitres: true },
  })

  return NextResponse.json({
    animal: { id: animal.id, nom: animal.nom, identifiant: animal.identifiant },
    ...projeterLactation({
      derniereMiseBas,
      collectes: collectes.map((c) => ({ date: c.date, quantiteLitres: Number(c.quantiteLitres) })),
      lactationLongue,
    }),
  })
}
