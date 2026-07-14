/**
 * POST /api/signalements — un membre signale une entrée communautaire problématique
 * (décision produit #3 : publication immédiate + modération a posteriori).
 * Cible polymorphe (refType, refId), même convention que les avis.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { AVIS_REF_TYPES, type AvisRefType } from '@/lib/avis/types'

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  try {
    const body = await request.json()
    const refType = body.refType as AvisRefType
    const refId = typeof body.refId === 'string' ? body.refId.trim() : ''
    const motif = typeof body.motif === 'string' ? body.motif.trim() : ''

    if (!AVIS_REF_TYPES.includes(refType) || !refId) {
      return NextResponse.json({ error: 'Signalement invalide.' }, { status: 400 })
    }
    if (motif.length < 3) {
      return NextResponse.json({ error: "Merci d'indiquer un motif." }, { status: 400 })
    }

    // Un seul signalement OUVERT par membre et par entrée (idempotent).
    const existing = await prisma.signalement.findFirst({
      where: { refType, refId, userId, statut: 'ouvert' },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, deja: true })
    }

    const sig = await prisma.signalement.create({
      data: { refType, refId, userId, motif: motif.slice(0, 2000) },
      select: { id: true },
    })
    return NextResponse.json({ ok: true, id: sig.id }, { status: 201 })
  } catch (e) {
    console.error('POST /api/signalements error:', e)
    return NextResponse.json({ error: 'Erreur lors du signalement.' }, { status: 500 })
  }
}
