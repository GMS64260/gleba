/**
 * PATCH /api/admin/signalements/[id] — traite un signalement (admin).
 * body.statut : 'traite' | 'rejete' | 'ouvert' (réouverture).
 * Le retrait effectif de l'entrée (rendre privé / supprimer) se fait via les
 * routes du référentiel concerné ; ici on ne change que le statut du signalement.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdminApi } from '@/lib/auth-utils'
import { getActeurId } from '@/lib/exploitation/garde-session'

type RouteParams = { params: Promise<{ id: string }> }

const STATUTS = ['ouvert', 'traite', 'rejete'] as const

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const statut = body.statut as string

    if (!STATUTS.includes(statut as (typeof STATUTS)[number])) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
    }

    const existing = await prisma.signalement.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Signalement introuvable.' }, { status: 404 })
    }

    const rouvert = statut === 'ouvert'
    // `depuis` : statut que l'écran avait sous les yeux. La décision ne
    // s'applique que s'il est toujours celui de la base : un signalement rejeté
    // ailleurs restait « traitable » depuis un onglet ouvert avant (D211).
    const depuis = body.depuis as string | undefined
    if (depuis !== undefined && !STATUTS.includes(depuis as (typeof STATUTS)[number])) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
    }
    const maj = await prisma.signalement.updateMany({
      where: { id, ...(depuis ? { statut: depuis } : {}) },
      data: {
        statut,
        resolvedAt: rouvert ? null : new Date(),
        resolvedById: rouvert ? null : getActeurId(session),
      },
    })
    if (maj.count === 0) {
      return NextResponse.json(
        { error: 'Ce signalement a déjà été traité ou rejeté depuis un autre onglet. Actualisez la liste.', code: 'MODIFIE_AILLEURS' },
        { status: 409 },
      )
    }
    const sig = await prisma.signalement.findUnique({ where: { id } })
    return NextResponse.json(sig)
  } catch (e) {
    console.error('PATCH /api/admin/signalements/[id] error:', e)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du signalement.' }, { status: 500 })
  }
}
