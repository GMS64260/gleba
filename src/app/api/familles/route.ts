/**
 * API Routes pour les Familles botaniques
 * GET /api/familles - Liste des familles
 * POST /api/familles - Créer une famille
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const familleSchema = z.object({
  id: z.string().min(1, "Le nom de la famille est requis").max(100),
  intervalle: z.number().int().min(0).max(10).default(4),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
})

// GET /api/familles
export async function GET() {
  try {
    const familles = await prisma.famille.findMany({
      include: {
        _count: {
          select: { especes: true },
        },
      },
      orderBy: { id: 'asc' },
    })

    return NextResponse.json(familles)
  } catch (error) {
    console.error('GET /api/familles error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des familles' },
      { status: 500 }
    )
  }
}

// POST /api/familles
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation
    const validationResult = familleSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Vérifier si la famille existe déjà
    const existing = await prisma.famille.findUnique({
      where: { id: data.id },
    })

    if (existing) {
      return NextResponse.json(
        { error: `La famille "${data.id}" existe déjà` },
        { status: 409 }
      )
    }

    // Création
    const famille = await prisma.famille.create({
      data,
    })

    return NextResponse.json(famille, { status: 201 })
  } catch (error) {
    console.error('POST /api/familles error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la famille' },
      { status: 500 }
    )
  }
}
