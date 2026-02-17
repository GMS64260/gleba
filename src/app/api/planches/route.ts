/**
 * API Routes pour les Planches
 * GET /api/planches - Liste des planches
 * POST /api/planches - Créer une planche
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createPlancheSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'

// GET /api/planches
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')
    const skip = (page - 1) * pageSize

    // Tri
    const sortBy = searchParams.get('sortBy') || 'nom'
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Filtres
    const search = searchParams.get('search') || ''
    const ilot = searchParams.get('ilot')
    const rotationId = searchParams.get('rotationId')

    // Construction du where - FILTRE PAR USER
    const where: Prisma.PlancheWhereInput = {
      userId: session!.user.id,
    }

    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { ilot: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (ilot) {
      where.ilot = ilot
    }

    if (rotationId) {
      where.rotationId = rotationId
    }

    // Requête avec comptage
    const [planches, total] = await Promise.all([
      prisma.planche.findMany({
        where,
        include: {
          rotation: true,
          _count: {
            select: {
              cultures: true,
              fertilisations: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.planche.count({ where }),
    ])

    return NextResponse.json({
      data: planches,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/planches error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des planches' },
      { status: 500 }
    )
  }
}

// POST /api/planches
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation
    const validationResult = createPlancheSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Vérifier si la planche existe déjà pour cet utilisateur (per-user unique)
    const existing = await prisma.planche.findUnique({
      where: {
        nom_userId: {
          nom: data.nom,
          userId: session!.user.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: `La planche "${data.nom}" existe déjà` },
        { status: 409 }
      )
    }

    // Calculer la surface si largeur et longueur sont fournies
    const surface = data.largeur && data.longueur
      ? data.largeur * data.longueur
      : data.surface

    // Création avec userId (id auto-generated as cuid)
    const { nom, ...rest } = data
    const planche = await prisma.planche.create({
      data: {
        ...rest,
        nom,
        surface,
        userId: session!.user.id,
      },
      include: {
        rotation: true,
      },
    })

    return NextResponse.json(planche, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/planches error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la planche' },
      { status: 500 }
    )
  }
}
