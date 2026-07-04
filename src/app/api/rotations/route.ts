/**
 * API Routes pour les Rotations
 * GET /api/rotations - Liste des rotations (referentiel global)
 * POST /api/rotations - Creer une rotation
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createRotationSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'

// GET /api/rotations
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

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
    const active = searchParams.get('active')

    // Construction du where
    const where: Prisma.RotationWhereInput = {}

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (active !== null && active !== undefined) {
      where.active = active === 'true'
    }

    // Requete avec comptage - optimisée avec select au lieu de include
    const [rotations, total] = await Promise.all([
      prisma.rotation.findMany({
        where,
        select: {
          id: true,
          active: true,
          nbAnnees: true,
          notes: true,
          details: {
            select: {
              id: true,
              annee: true,
              itpId: true,
              itp: {
                select: {
                  id: true,
                  espece: {
                    select: {
                      id: true,
                      couleur: true,
                    },
                  },
                },
              },
            },
            orderBy: { annee: 'asc' },
          },
          _count: {
            select: {
              // BUG #16 (audit Marc 2026-05-15) : avant on comptait toutes
              // les planches reliées à la rotation (tous users) → on tombait
              // souvent à 0 pour le tenant courant et Marc voyait
              // « 0 planches » sur ses 5 rotations actives. On filtre
              // désormais sur `userId` du tenant.
              planches: { where: { userId } },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.rotation.count({ where }),
    ])

    return NextResponse.json({
      data: rotations,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/rotations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des rotations', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// POST /api/rotations
export async function POST(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation
    const validationResult = createRotationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const { details, ...rotationData } = validationResult.data

    // Verifier si la rotation existe deja
    const existing = await prisma.rotation.findUnique({
      where: { id: rotationData.id },
    })

    if (existing) {
      return NextResponse.json(
        { error: `La rotation "${rotationData.id}" existe deja` },
        { status: 409 }
      )
    }

    // Calculer nbAnnees si des details sont fournis
    const nbAnnees = details && details.length > 0
      ? Math.max(...details.map(d => d.annee))
      : rotationData.nbAnnees

    // Creation avec details - optimisée avec select
    const rotation = await prisma.rotation.create({
      data: {
        ...rotationData,
        nbAnnees,
        details: details ? {
          create: details.map(d => ({
            annee: d.annee,
            itpId: d.itpId,
          })),
        } : undefined,
      },
      select: {
        id: true,
        active: true,
        nbAnnees: true,
        notes: true,
        details: {
          select: {
            id: true,
            annee: true,
            itpId: true,
            itp: {
              select: {
                id: true,
                espece: {
                  select: {
                    id: true,
                    couleur: true,
                  },
                },
              },
            },
          },
          orderBy: { annee: 'asc' },
        },
      },
    })

    return NextResponse.json(rotation, { status: 201 })
  } catch (error) {
    console.error('POST /api/rotations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la creation de la rotation' },
      { status: 500 }
    )
  }
}
