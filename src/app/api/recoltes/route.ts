/**
 * API Routes pour les Récoltes
 * GET /api/recoltes - Liste des recoltes
 * POST /api/recoltes - Créer une recolte
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createRecolteSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'
import { invalidateKpi } from '@/lib/kpi'
import { snapshotStatutBio } from '@/lib/statut-bio'

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
    const annee = searchParams.get('annee')

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

    if (annee) {
      const year = parseInt(annee)
      where.date = {
        gte: new Date(year, 0, 1),
        lt: new Date(year + 1, 0, 1),
      }
    } else if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) {
        where.date.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo)
      }
    }

    // Requête avec comptage
    const [recoltes, total, stats, especesDistinctes] = await Promise.all([
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
      // Espèces distinctes présentes dans les recoltes de l'utilisateur
      prisma.recolte.findMany({
        where: { userId: session!.user.id },
        select: { especeId: true },
        distinct: ['especeId'],
        orderBy: { especeId: 'asc' },
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
      especes: especesDistinctes.map(e => ({ id: e.especeId })),
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

    // Vérifier que la culture existe et appartient à l'utilisateur.
    // PROMPT 12 : on charge aussi la planche pour snapshoter le statut Bio
    // au moment de la récolte (la valeur reste figée même si la planche évolue).
    const culture = await prisma.culture.findUnique({
      where: {
        id: data.cultureId,
        userId: session!.user.id,
      },
      include: {
        espece: true,
        planche: { select: { statutBio: true, dateDebutConversion: true } },
      },
    })

    if (!culture) {
      return NextResponse.json(
        { error: `La culture #${data.cultureId} n'existe pas` },
        { status: 400 }
      )
    }

    // Vérifier cohérence espece
    if (culture.especeId !== data.especeId) {
      return NextResponse.json(
        { error: `L'espèce de la récolte doit correspondre à l'espece de la culture` },
        { status: 400 }
      )
    }

    // PROMPT 12 — snapshot statut Bio depuis la planche (si rattachée).
    const dateRecolte = data.date ? new Date(data.date as unknown as string) : new Date()
    const statutBioSnapshot = culture.planche
      ? snapshotStatutBio(
          culture.planche.statutBio,
          culture.planche.dateDebutConversion,
          dateRecolte
        )
      : null

    // Création de la recolte + mise à jour culture + INCRÉMENT STOCK
    // en transaction atomique.
    //
    // QA 2026-05-15 — Bug #7 : la création d'une `Recolte` ne touchait
    // pas `UserStockEspece`, donc l'écran Stocks Maraîchage restait à
    // 0 article alors qu'on avait 90 kg récoltés. On incrémente
    // désormais l'inventaire de l'espèce à chaque récolte en_stock.
    // Statut "vendu" / "consomme" / "perte" → pas d'incrément (la
    // récolte sort directement, pas en stock).
    const recolte = await prisma.$transaction(async (tx) => {
      const newRecolte = await tx.recolte.create({
        data: {
          ...data,
          userId: session!.user.id,
          statutBioSnapshot,
        },
        include: {
          espece: true,
          culture: true,
        },
      })

      if (!culture.recolteFaite) {
        await tx.culture.update({
          where: { id: data.cultureId },
          data: { recolteFaite: true },
        })
      }

      // Refonte stock 2026-07 (modèle baseline + événements) : on ne touche
      // plus UserStockEspece.inventaire ici. Le stock est recalculé par
      // calculerStocksNet à partir des récoltes en stock + inventaire manuel.
      // (Avant, l'incrément ici était re-additionné par calculerStocksNet →
      // double comptage, audit #28.)

      return newRecolte
    })

    invalidateKpi(session!.user.id)
    return NextResponse.json(recolte, { status: 201 })
  } catch (error) {
    console.error('POST /api/recoltes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la récolte' },
      { status: 500 }
    )
  }
}
