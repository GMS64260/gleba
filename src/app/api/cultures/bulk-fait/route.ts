/**
 * Action en masse "Marquer fait" sur les tâches culture (PROMPT 20a).
 *
 * POST /api/cultures/bulk-fait
 *   body: { ids: number[], type: 'semis' | 'plantation' | 'recolte' }
 *
 * Marque le champ correspondant (semisFait | plantationFaite | recolteFaite)
 * à true pour les cultures de l'utilisateur. Renvoie le nombre traités.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const FIELD_MAP = {
  semis: 'semisFait',
  plantation: 'plantationFaite',
  recolte: 'recolteFaite',
} as const

const schema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
  type: z.enum(['semis', 'plantation', 'recolte']),
})

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { ids, type } = parsed.data
    const field = FIELD_MAP[type]

    // L'updateMany applique le where {userId} pour la sécurité — pas de fuite cross-tenant
    const r = await prisma.culture.updateMany({
      where: { id: { in: ids }, userId: session.user.id },
      data: { [field]: true },
    })

    return NextResponse.json({ updated: r.count })
  } catch (err) {
    console.error('POST /api/cultures/bulk-fait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
