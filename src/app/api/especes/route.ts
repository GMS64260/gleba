/**
 * API Routes pour les Espèces
 * GET /api/especes - Liste des espèces (avec filtres, pagination, tri)
 * POST /api/especes - Créer une espèce
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createEspeceSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

// GET /api/especes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const skip = (page - 1) * pageSize

    // Tri
    const sortBy = searchParams.get('sortBy') || 'id'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Filtres
    const search = searchParams.get('search') || ''
    const familleId = searchParams.get('familleId')
    const vivace = searchParams.get('vivace')
    const aPlanifier = searchParams.get('aPlanifier')

    // Construction du where
    const where: Prisma.EspeceWhereInput = {}

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { nomLatin: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (familleId) {
      where.familleId = familleId
    }

    if (vivace !== null && vivace !== undefined) {
      where.vivace = vivace === 'true'
    }

    if (aPlanifier !== null && aPlanifier !== undefined) {
      where.aPlanifier = aPlanifier === 'true'
    }

    // Requête avec comptage
    const [especes, total] = await Promise.all([
      prisma.espece.findMany({
        where,
        include: {
          famille: true,
          _count: {
            select: {
              varietes: true,
              cultures: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.espece.count({ where }),
    ])

    return NextResponse.json({
      data: especes,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/especes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des espèces' },
      { status: 500 }
    )
  }
}

// POST /api/especes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation
    const validationResult = createEspeceSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Vérifier si l'espèce existe déjà
    const existing = await prisma.espece.findUnique({
      where: { id: data.id },
    })

    if (existing) {
      return NextResponse.json(
        { error: `L'espèce "${data.id}" existe déjà` },
        { status: 409 }
      )
    }

    // Création
    const espece = await prisma.espece.create({
      data,
      include: {
        famille: true,
      },
    })

    return NextResponse.json(espece, { status: 201 })
  } catch (error) {
    console.error('POST /api/especes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'espèce' },
      { status: 500 }
    )
  }
}
