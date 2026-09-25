/**
 * POST /api/elevage/lots/[id]/animaux — composer un lot en une fois.
 *
 * Corps : { ajouter?: number[], retirer?: number[] } (identifiants d'animaux).
 * Les règles vivent dans `composerLot` (src/lib/elevage/composition-lot.ts),
 * partagées avec l'assistant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import { composerLot } from '@/lib/elevage/composition-lot'

type RouteParams = { params: Promise<{ id: string }> }

const ids = z.array(z.number().int().positive()).max(500).default([])
const corpsSchema = z.object({ ajouter: ids, retirer: ids })
  .refine((c) => c.ajouter.length + c.retirer.length > 0, { message: 'Aucun animal indiqué' })

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { id: idParam } = await params
  const lotId = parseInt(idParam, 10)
  if (Number.isNaN(lotId)) {
    return NextResponse.json({ error: 'ID de lot invalide' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }
  const parsed = corpsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const resultat = await composerLot(session.user.id, lotId, parsed.data)
    if (!resultat.ok) {
      return NextResponse.json(
        { error: resultat.error, ...('details' in resultat ? { details: resultat.details } : {}) },
        { status: resultat.status },
      )
    }
    return NextResponse.json({ data: { ajoutes: resultat.ajoutes, retires: resultat.retires } })
  } catch (e) {
    console.error('POST /api/elevage/lots/[id]/animaux error:', e)
    return NextResponse.json(
      { error: 'Erreur lors de la composition du lot', details: 'Erreur interne du serveur' },
      { status: 500 },
    )
  }
}
