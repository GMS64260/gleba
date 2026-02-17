/**
 * API Routes pour les Variétés
 * GET /api/varietes - Liste des variétés (référentiel global)
 * POST /api/varietes - Créer une variété
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createVarieteSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'

// GET /api/varietes - Référentiel global (lecture)
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

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
    const especeId = searchParams.get('especeId')
    const fournisseurId = searchParams.get('fournisseurId')
    const bio = searchParams.get('bio')

    // Construction du where
    const where: Prisma.VarieteWhereInput = {}

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { espece: { id: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (especeId) {
      where.especeId = especeId
    }

    if (fournisseurId) {
      where.fournisseurId = fournisseurId
    }

    if (bio === 'true') {
      where.bio = true
    } else if (bio === 'false') {
      where.bio = false
    }

    // Requête avec comptage
    const userId = session!.user.id
    const [varietes, total] = await Promise.all([
      prisma.variete.findMany({
        where,
        include: {
          espece: {
            include: {
              famille: true,
            },
          },
          fournisseur: true,
          _count: {
            select: {
              cultures: true,
            },
          },
          userStocks: {
            where: { userId },
            select: {
              stockGraines: true,
              stockPlants: true,
              dateStock: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.variete.count({ where }),
    ])

    // Enrichir les variétés avec le stock per-user
    const enriched = varietes.map(v => {
      const userStock = v.userStocks[0]
      const { userStocks: _us, ...rest } = v
      return {
        ...rest,
        userStockGraines: userStock?.stockGraines ?? null,
        userStockPlants: userStock?.stockPlants ?? null,
        userStockDate: userStock?.dateStock ?? null,
      }
    })

    return NextResponse.json({
      data: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/varietes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des variétés', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// POST /api/varietes (admin only - données de référence globales)
export async function POST(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation
    const validationResult = createVarieteSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Vérifier si la variété existe déjà
    const existing = await prisma.variete.findUnique({
      where: { id: data.id },
    })

    if (existing) {
      return NextResponse.json(
        { error: `La variété "${data.id}" existe déjà` },
        { status: 409 }
      )
    }

    // Vérifier que l'espèce existe
    const espece = await prisma.espece.findUnique({
      where: { id: data.especeId },
    })
    if (!espece) {
      return NextResponse.json(
        { error: `L'espèce "${data.especeId}" n'existe pas` },
        { status: 400 }
      )
    }

    // Vérifier que le fournisseur existe si fourni
    if (data.fournisseurId) {
      const fournisseur = await prisma.fournisseur.findUnique({
        where: { id: data.fournisseurId },
      })
      if (!fournisseur) {
        return NextResponse.json(
          { error: `Le fournisseur "${data.fournisseurId}" n'existe pas` },
          { status: 400 }
        )
      }
    }

    // Création
    const variete = await prisma.variete.create({
      data,
      include: {
        espece: true,
        fournisseur: true,
      },
    })

    return NextResponse.json(variete, { status: 201 })
  } catch (error) {
    console.error('POST /api/varietes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la variété' },
      { status: 500 }
    )
  }
}
