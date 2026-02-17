/**
 * API Routes pour les ITPs (Itinéraires Techniques de Plantes)
 * GET /api/itps - Liste des ITPs (référentiel global)
 * POST /api/itps - Créer un ITP
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createITPSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'

// GET /api/itps - Référentiel global (lecture)
export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
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

    // Construction du where
    const where: Prisma.ITPWhereInput = {}

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { espece: { id: { contains: search, mode: 'insensitive' } } },
      ]
    }

    if (especeId) {
      where.especeId = especeId
    }

    // Requête avec comptage
    const [itps, total] = await Promise.all([
      prisma.iTP.findMany({
        where,
        include: {
          espece: {
            include: {
              famille: true,
            },
          },
          _count: {
            select: {
              cultures: true,
              rotationsDetails: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.iTP.count({ where }),
    ])

    return NextResponse.json({
      data: itps,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/itps error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des ITPs', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// POST /api/itps
export async function POST(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation
    const validationResult = createITPSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Vérifier si l'ITP existe déjà
    const existing = await prisma.iTP.findUnique({
      where: { id: data.id },
    })

    if (existing) {
      return NextResponse.json(
        { error: `L'ITP "${data.id}" existe déjà` },
        { status: 409 }
      )
    }

    // Vérifier que l'espèce existe si fournie
    if (data.especeId) {
      const espece = await prisma.espece.findUnique({
        where: { id: data.especeId },
      })
      if (!espece) {
        return NextResponse.json(
          { error: `L'espèce "${data.especeId}" n'existe pas` },
          { status: 400 }
        )
      }
    }

    // Création
    const itp = await prisma.iTP.create({
      data,
      include: {
        espece: true,
      },
    })

    return NextResponse.json(itp, { status: 201 })
  } catch (error) {
    console.error('POST /api/itps error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'ITP' },
      { status: 500 }
    )
  }
}
