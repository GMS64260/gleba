/**
 * API Route pour creer les cultures en batch
 * POST /api/planification/creer-cultures
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'
import { creerCulturesBatch } from '@/lib/planification'
import { z } from 'zod'

const creerCulturesSchema = z.object({
  cultures: z.array(z.object({
    plancheId: z.string(),
    itpId: z.string(),
    annee: z.number(),
    varieteId: z.string().optional(),
  })),
})

export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const body = await request.json()

    // Validation
    const validationResult = creerCulturesSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { cultures } = validationResult.data

    if (cultures.length === 0) {
      return NextResponse.json(
        { error: 'Aucune culture a creer' },
        { status: 400 }
      )
    }

    const result = await creerCulturesBatch(userId, cultures)

    return NextResponse.json({
      success: true,
      created: result.created,
      cultures: result.cultures,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/planification/creer-cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la creation des cultures', details: String(error) },
      { status: 500 }
    )
  }
}
