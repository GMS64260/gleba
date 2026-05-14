/**
 * API Routes pour les Espèces
 * GET /api/especes - Liste des especes (referentiel global, lecture pour tous les users)
 * POST /api/especes - Créer une espece
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createEspeceSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'
import { cleanReferentielName, normalizeReferentielKey } from '@/lib/normalize'

// GET /api/especes - Référentiel global (lecture)
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
    const familleId = searchParams.get('familleId')
    const vivace = searchParams.get('vivace')
    const aPlanifier = searchParams.get('aPlanifier')
    const type = searchParams.get('type')

    // Audit Marc Bug #6 — Compteur "Cultures" : par défaut "saison active"
    // = cultures de l'année en cours non terminées. Mode "historique"
    // restitue le cumul depuis le début (ancien comportement).
    const cultureCount = searchParams.get('cultureCount') || 'saison'
    const saisonAnnee = parseInt(searchParams.get('annee') || new Date().getFullYear().toString())

    // Construction du where
    const where: Prisma.EspeceWhereInput = {}

    if (type) {
      // Support special 'all_arbres' type which filters for tree types
      if (type === 'all_arbres') {
        where.type = { in: ['arbre_fruitier', 'petit_fruit'] }
      } else {
        where.type = type
      }
    }

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

    // Audit Marc Bug #6 — _count.cultures filtré sur année + non-terminée
    // pour le mode "saison". Sinon cumul historique.
    const cultureCountWhere =
      cultureCount === 'saison'
        ? { annee: saisonAnnee, terminee: null }
        : undefined

    // Requête avec comptage
    const [especes, total] = await Promise.all([
      prisma.espece.findMany({
        where,
        include: {
          famille: true,
          _count: {
            select: {
              varietes: true,
              cultures: cultureCountWhere ? { where: cultureCountWhere } : true,
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
      cultureCount,
      annee: saisonAnnee,
    })
  } catch (error) {
    console.error('GET /api/especes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des espèces', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// POST /api/especes (admin only - données de reference globales)
export async function POST(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

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

    // Normalisation du nom pour éviter "Carotte Nantaise" vs "Carotte-Nantaise"
    const cleanedId = cleanReferentielName(data.id)
    if (cleanedId !== data.id) {
      data.id = cleanedId
    }

    // Vérifier si l'espece existe déjà (exact)
    const existing = await prisma.espece.findUnique({
      where: { id: data.id },
    })

    if (existing) {
      return NextResponse.json(
        { error: `L'espece "${data.id}" existe déjà` },
        { status: 409 }
      )
    }

    // Détection de doublon "mou" (différence d'accent / tiret / espace / casse)
    const normalizedKey = normalizeReferentielKey(data.id)
    const allEspeces = await prisma.espece.findMany({ select: { id: true } })
    const conflit = allEspeces.find((e) => normalizeReferentielKey(e.id) === normalizedKey)
    if (conflit) {
      return NextResponse.json(
        {
          error: `Une espece similaire existe déjà : "${conflit.id}". Si c'est la même espece, utilisez-la ; sinon, choisissez un nom plus distinctif.`,
          conflit: conflit.id,
        },
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
      { error: 'Erreur lors de la création de l\'espece' },
      { status: 500 }
    )
  }
}
