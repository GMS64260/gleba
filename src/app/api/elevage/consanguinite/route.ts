/**
 * Vérification consanguinité entre une femelle et un mâle candidats.
 * GET /api/elevage/consanguinite?femelleId=10&maleId=20&generations=3
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import {
  detecterConsanguinite,
  type AncetreCommun,
  type ReponseConsanguinite,
} from '@/lib/reproduction'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const femelleId = parseInt(searchParams.get('femelleId') || '0', 10)
  const maleId = parseInt(searchParams.get('maleId') || '0', 10)
  const generationsLues = parseInt(searchParams.get('generations') || '3', 10)
  // Bornées : chaque génération double le nombre d'ancêtres relus.
  const generations = Number.isFinite(generationsLues) ? Math.min(6, Math.max(1, generationsLues)) : 3
  if (!femelleId || !maleId) return NextResponse.json({ error: 'femelleId et maleId requis' }, { status: 400 })

  const [f, m] = await Promise.all([
    prisma.animal.findFirst({ where: { id: femelleId, userId: session.user.id }, select: { id: true } }),
    prisma.animal.findFirst({ where: { id: maleId, userId: session.user.id }, select: { id: true } }),
  ])
  if (!f || !m) return NextResponse.json({ error: 'Animaux non trouvés' }, { status: 404 })

  const ancetresCommuns = await detecterConsanguinite(prisma, femelleId, maleId, generations, session.user.id)
  // L'écran nomme les ancêtres : on lui donne leurs fiches, pas seulement des
  // identifiants (il affichait « #undefined », D59). Un ancêtre est souvent
  // mort ou vendu, donc absent de la liste des animaux actifs du navigateur.
  const fiches = ancetresCommuns.length
    ? await prisma.animal.findMany({
        where: { id: { in: ancetresCommuns }, userId: session.user.id },
        select: { id: true, nom: true, identifiant: true },
      })
    : []
  const parId = new Map(fiches.map((a) => [a.id, a]))
  const ancetres: AncetreCommun[] = ancetresCommuns.map(
    (id) => parId.get(id) ?? { id, nom: null, identifiant: null },
  )
  return NextResponse.json({
    consanguinite: ancetresCommuns.length > 0,
    generations,
    ancetresCommuns,
    ancetres,
  } satisfies ReponseConsanguinite)
}
