/**
 * API Routes pour les Récoltes
 * GET /api/recoltes - Liste des récoltes
 * POST /api/recoltes - Créer une récolte
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createRecolteSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'

// GET /api/recoltes
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const skip = (page - 1) * pageSize

    // Tri
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Filtres
    const search = searchParams.get('search') || ''
    const especeId = searchParams.get('especeId')
    const cultureId = searchParams.get('cultureId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Construction du where - FILTRE PAR USER
    const where: Prisma.RecolteWhereInput = {
      userId: session!.user.id,
    }

    if (search) {
      where.OR = [
        { espece: { id: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (especeId) {
      where.especeId = especeId
    }

    if (cultureId) {
      where.cultureId = parseInt(cultureId)
    }

    if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) {
        where.date.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo)
      }
    }

    // Requête avec comptage
    const [recoltes, total, stats] = await Promise.all([
      prisma.recolte.findMany({
        where,
        include: {
          espece: {
            include: { famille: true },
          },
          culture: {
            include: {
              variete: true,
              planche: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.recolte.count({ where }),
      // Statistiques globales
      prisma.recolte.aggregate({
        where,
        _sum: { quantite: true },
        _count: { _all: true },
      }),
    ])

    return NextResponse.json({
      data: recoltes,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: {
        totalQuantite: stats._sum.quantite || 0,
        count: stats._count._all,
      },
    })
  } catch (error) {
    console.error('GET /api/recoltes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des récoltes' },
      { status: 500 }
    )
  }
}

// POST /api/recoltes
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation
    const validationResult = createRecolteSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Vérifier que la culture existe et appartient à l'utilisateur
    const culture = await prisma.culture.findUnique({
      where: {
        id: data.cultureId,
        userId: session!.user.id,
      },
      include: { espece: true },
    })

    if (!culture) {
      return NextResponse.json(
        { error: `La culture #${data.cultureId} n'existe pas` },
        { status: 400 }
      )
    }

    // Vérifier cohérence espèce
    if (culture.especeId !== data.especeId) {
      return NextResponse.json(
        { error: `L'espèce de la récolte doit correspondre à l'espèce de la culture` },
        { status: 400 }
      )
    }

    // Création de la récolte avec userId
    const recolte = await prisma.recolte.create({
      data: {
        ...data,
        userId: session!.user.id,
      },
      include: {
        espece: true,
        culture: true,
      },
    })

    // Mettre à jour l'état de la culture si nécessaire
    if (!culture.recolteFaite) {
      await prisma.culture.update({
        where: { id: data.cultureId },
        data: { recolteFaite: true },
      })
    }

    return NextResponse.json(recolte, { status: 201 })
  } catch (error) {
    console.error('POST /api/recoltes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la récolte' },
      { status: 500 }
    )
  }
}
