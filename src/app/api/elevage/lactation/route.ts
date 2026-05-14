/**
 * Courbe de lactation 305 jours pour un animal donné.
 * GET /api/elevage/lactation?animalId=42
 *
 * Stratégie : dernière mise-bas connue = origine du DIM (Days In Milk).
 * Si pas de naissance enregistrée, on retombe sur la première collecte du
 * cycle en cours (heuristique de fallback).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { courbeLactation, dim } from '@/lib/lait'

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

  const derniereMiseBas = animal.naissancesMere[0]?.date

  // Cherche les collectes depuis la mise-bas (ou les 305 derniers jours)
  const since = derniereMiseBas ?? new Date(Date.now() - 305 * 86_400_000)

  const collectes = await prisma.collecteLait.findMany({
    where: { animalId, userId: session.user.id, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: { date: true, quantiteLitres: true },
  })

  if (!derniereMiseBas && collectes.length === 0) {
    return NextResponse.json({
      animal: { id: animal.id, nom: animal.nom, identifiant: animal.identifiant },
      courbe: [],
      dim: null,
      suggererTarissement: false,
    })
  }

  const dateOrigine = derniereMiseBas ?? collectes[0].date
  const courbe = courbeLactation(
    collectes.map((c) => ({ date: c.date, quantiteLitres: Number(c.quantiteLitres) })),
    dateOrigine
  )
  const dimAct = dim(dateOrigine)

  // Suggestion tarissement : DIM > 270 OU moyenne 7j < 0.5 L/j
  const derniers7j = courbe.slice(-7)
  const moy7 = derniers7j.length > 0
    ? derniers7j.reduce((s, p) => s + p.volume, 0) / derniers7j.length
    : 0
  const suggererTarissement = dimAct > 270 || (dimAct > 60 && moy7 < 0.5)

  return NextResponse.json({
    animal: { id: animal.id, nom: animal.nom, identifiant: animal.identifiant },
    dateOrigine,
    dim: dimAct,
    courbe,
    moyenne7j: Math.round(moy7 * 1000) / 1000,
    suggererTarissement,
  })
}
