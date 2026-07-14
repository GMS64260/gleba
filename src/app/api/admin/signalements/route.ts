/**
 * GET /api/admin/signalements — liste des signalements pour modération (admin).
 * ?statut=ouvert (défaut) | traite | rejete | tous. Enrichit chaque signalement
 * du nom + origine de l'entrée signalée, et de la base d'API du référentiel.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdminApi } from '@/lib/auth-utils'
import type { AvisRefType } from '@/lib/avis/types'
import { resolveEntreesSignalees, SIGNALEMENT_API_BASE } from '@/lib/signalements'

export async function GET(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const statut = new URL(request.url).searchParams.get('statut') || 'ouvert'
    const signalements = await prisma.signalement.findMany({
      where: statut === 'tous' ? {} : { statut },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { auteur: { select: { id: true, name: true, email: true } } },
    })

    // Résolution du nom/origine de chaque entrée signalée, groupée par refType.
    const parType = new Map<AvisRefType, string[]>()
    for (const s of signalements) {
      const arr = parType.get(s.refType) ?? []
      arr.push(s.refId)
      parType.set(s.refType, arr)
    }
    const resolved: Record<string, { nom: string; userId: string | null; partageCommunaute: boolean }> = {}
    await Promise.all(
      [...parType].map(async ([refType, ids]) => {
        const map = await resolveEntreesSignalees(refType, ids)
        for (const [id, v] of map) resolved[`${refType}:${id}`] = v
      })
    )

    const data = signalements.map((s) => ({
      ...s,
      entree: resolved[`${s.refType}:${s.refId}`] ?? null,
      apiBase: SIGNALEMENT_API_BASE[s.refType],
    }))

    return NextResponse.json({ data })
  } catch (e) {
    console.error('GET /api/admin/signalements error:', e)
    return NextResponse.json({ error: 'Erreur lors du chargement des signalements.' }, { status: 500 })
  }
}
