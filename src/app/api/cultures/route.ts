/**
 * API Routes pour les Cultures
 * GET /api/cultures - Liste des cultures (avec filtres, pagination, tri)
 * POST /api/cultures - Créer une culture
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createCultureSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'

// GET /api/cultures
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const skip = (page - 1) * pageSize

    // Tri
    const sortBy = searchParams.get('sortBy') || 'id'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Filtres
    const search = searchParams.get('search') || ''
    const annee = searchParams.get('annee')
    const especeId = searchParams.get('especeId')
    const plancheId = searchParams.get('plancheId')
    const etat = searchParams.get('etat') // Planifiée, Semée, Plantée, En récolte, Terminée

    // Construction du where
    const where: Prisma.CultureWhereInput = {}

    if (search) {
      where.OR = [
        { espece: { id: { contains: search, mode: 'insensitive' } } },
        { variete: { id: { contains: search, mode: 'insensitive' } } },
        { planche: { id: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (annee) {
      where.annee = parseInt(annee)
    }

    if (especeId) {
      where.especeId = especeId
    }

    if (plancheId) {
      where.plancheId = plancheId
    }

    // Filtre par état (calculé)
    if (etat) {
      switch (etat) {
        case 'Planifiée':
          where.semisFait = false
          where.terminee = null
          break
        case 'Semée':
          where.semisFait = true
          where.plantationFaite = false
          where.terminee = null
          break
        case 'Plantée':
          where.plantationFaite = true
          where.recolteFaite = false
          where.terminee = null
          break
        case 'En récolte':
          where.recolteFaite = true
          where.terminee = null
          break
        case 'Terminée':
          where.terminee = { not: null }
          break
      }
    }

    // Requête avec comptage
    const [cultures, total] = await Promise.all([
      prisma.culture.findMany({
        where,
        include: {
          espece: {
            include: { famille: true },
          },
          variete: true,
          itp: true,
          planche: true,
          _count: {
            select: { recoltes: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.culture.count({ where }),
    ])

    // Ajouter les champs calculés
    const culturesWithComputed = cultures.map((culture) => ({
      ...culture,
      // Calcul de l'état
      etat: culture.terminee
        ? 'Terminée'
        : culture.recolteFaite
          ? 'En récolte'
          : culture.plantationFaite
            ? 'Plantée'
            : culture.semisFait
              ? 'Semée'
              : 'Planifiée',
      // Calcul du type
      type: culture.espece?.vivace
        ? 'Vivace'
        : culture.dateSemis && culture.datePlantation && culture.dateRecolte
          ? 'Semis pépinière'
          : culture.dateSemis && culture.dateRecolte
            ? 'Semis en place'
            : culture.datePlantation && culture.dateRecolte
              ? 'Plant'
              : 'Non défini',
    }))

    return NextResponse.json({
      data: culturesWithComputed,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('GET /api/cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des cultures' },
      { status: 500 }
    )
  }
}

// POST /api/cultures
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validation
    const validationResult = createCultureSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

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

    // Création
    const culture = await prisma.culture.create({
      data,
      include: {
        espece: true,
        variete: true,
        itp: true,
        planche: true,
      },
    })

    return NextResponse.json(culture, { status: 201 })
  } catch (error) {
    console.error('POST /api/cultures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la culture' },
      { status: 500 }
    )
  }
}
