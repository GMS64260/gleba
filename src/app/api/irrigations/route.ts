/**
 * API Routes pour les Irrigations Planifiées
 * GET /api/irrigations - Liste des irrigations
 * POST /api/irrigations - Créer une irrigation
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'

// GET /api/irrigations
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)

    const cultureId = searchParams.get('cultureId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const fait = searchParams.get('fait')

    const where: any = { userId }

    if (cultureId) {
      where.cultureId = parseInt(cultureId)
    }

    if (start && end) {
      where.datePrevue = {
        gte: new Date(start),
        lte: new Date(end),
      }
    }

    if (fait !== null && fait !== undefined) {
      where.fait = fait === 'true'
    }

    const irrigations = await prisma.irrigationPlanifiee.findMany({
      where,
      include: {
        culture: {
          include: {
            espece: {
              select: {
                id: true,
                couleur: true,
                besoinEau: true,
              },
            },
          },
        },
      },
      orderBy: { datePrevue: 'asc' },
    })

    return NextResponse.json({ data: irrigations })
  } catch (error) {
    console.error('GET /api/irrigations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des irrigations', details: String(error) },
      { status: 500 }
    )
  }
}

// POST /api/irrigations
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const body = await request.json()

    const { cultureId, datePrevue, notes } = body

    if (!cultureId || !datePrevue) {
      return NextResponse.json(
        { error: 'cultureId et datePrevue sont requis' },
        { status: 400 }
      )
    }

    // Vérifier que la culture appartient à l'utilisateur
    const culture = await prisma.culture.findFirst({
      where: { id: cultureId, userId },
    })

    if (!culture) {
      return NextResponse.json(
        { error: 'Culture non trouvée' },
        { status: 404 }
      )
    }

    const irrigation = await prisma.irrigationPlanifiee.create({
      data: {
        userId,
        cultureId,
        datePrevue: new Date(datePrevue),
        notes,
      },
      include: {
        culture: {
          include: {
            espece: true,
          },
        },
      },
    })

    return NextResponse.json(irrigation, { status: 201 })
  } catch (error) {
    console.error('POST /api/irrigations error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'irrigation", details: String(error) },
      { status: 500 }
    )
  }
}
