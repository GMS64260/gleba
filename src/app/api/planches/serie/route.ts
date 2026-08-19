/**
 * POST /api/planches/serie
 *
 * Crée un lot de planches identiques nommées en série (Z1p1, Z1p2, …).
 * Né du constat du 2026-08-06 : créer 16 planches de rang identiques n'était
 * possible ni depuis l'écran ni depuis l'assistant, qui promettait le lot puis
 * n'en créait qu'une. Voir `src/lib/planches/serie.ts`.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { invalidateKpi } from '@/lib/kpi'
import { creerPlanchesSerie, messageSerie, planchesSerieSchema } from '@/lib/planches/serie'

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const parsed = planchesSerieSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const resultat = await prisma.$transaction((tx) =>
      creerPlanchesSerie(tx, session!.user.id, parsed.data),
    )

    if (resultat.crees.length > 0) invalidateKpi(session!.user.id)
    return NextResponse.json(
      { ...resultat, message: messageSerie(resultat) },
      { status: resultat.crees.length > 0 ? 201 : 200 },
    )
  } catch (err) {
    // Nom trop long : erreur de saisie, pas une panne.
    if (err instanceof Error && err.message.startsWith('Nom de planche trop long')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('POST /api/planches/serie error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la série de planches' },
      { status: 500 },
    )
  }
}
