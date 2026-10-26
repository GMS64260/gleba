/**
 * API Routes pour les Récoltes
 * GET /api/recoltes - Liste des recoltes
 * POST /api/recoltes - Créer une recolte
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { creerRecoltes } from '@/lib/recolte/creation'
import { createRecolteSchema } from '@/lib/validations/recolte'
import { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'
import { type UniteQuantite } from '@/lib/recolte/projection'
import { ajouterQuantite, arrondirQuantites, partKg, type QuantiteParUnite } from '@/lib/recolte/quantites'
import { masquerReferentielsEmbarques } from '@/lib/referentiel-embarque'
import { chargerPrixVentesMoyens, valoriserLot } from '@/lib/recolte/valorisation'

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
    const [recoltes, total, stats, especesDistinctes, prixVentes] = await Promise.all([
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
      // Statistiques globales, VENTILÉES PAR UNITÉ : un `_sum` sur `quantite`
      // additionnerait des tiges à des kilos dès qu'une espèce est comptée
      // autrement (2026-08-20).
      prisma.recolte.groupBy({
        by: ['unite'],
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
      // Ticket cmvnvaal2 — prix de vente moyens (espèce, unité) des 90 derniers
      // jours, toutes années et espèces : la valeur d'un lot ne dépend pas du
      // filtre de l'écran, elle est celle de Comptabilité > Stocks unifiés.
      chargerPrixVentesMoyens(prisma, session!.user.id),
    ])

    // Valeur d'un lot EN STOCK par la règle unique (`valoriserLot`) : prix du
    // lot, fiche d'une espèce personnelle dans son unité, vente moyenne dans
    // l'unité du lot, catalogue et barème pour des kilos du catalogue. La
    // source est toujours dite (`aucune` = non valorisé) ; null = lot sorti.
    const recoltesValorisees = recoltes.map((r) => ({
      ...r,
      valorisation:
        r.statut === 'en_stock'
          ? valoriserLot(
              {
                acteurId: session!.user.id,
                especeId: r.especeId,
                unite: r.unite,
                quantite: r.quantite,
                prixLot: r.prixKg,
                espece: r.espece,
              },
              prixVentes,
            )
          : null,
    }))

    const statsParUnite = arrondirQuantites(
      stats.reduce<QuantiteParUnite>(
        (acc, ligne) =>
          ajouterQuantite(acc, (ligne.unite ?? 'kg') as UniteQuantite, ligne._sum.quantite || 0),
        {},
      ),
    )

    // Espèce et variété embarquées : jamais l'id de l'auteur d'une entrée
    // partagée par un autre compte (revue 2026-10-20).
    return NextResponse.json({
      data: masquerReferentielsEmbarques(recoltesValorisees, session!.user.id),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats: {
        // `totalQuantite` garde son nom et devient la PART EN KILOS ; la
        // ventilation complète vit dans `totalParUnite`.
        totalQuantite: partKg(statsParUnite),
        totalParUnite: statsParUnite,
        count: stats.reduce((somme, ligne) => somme + ligne._count._all, 0),
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
    // Le formulaire exprime déjà la quantité dans l'unité de la ferme.
    // Son schéma retire toute unité client, comme avant la mutualisation.
    const validation = createRecolteSchema.safeParse(await request.json())
    if (!validation.success) return NextResponse.json({ error: 'Données invalides', details: validation.error.flatten() }, { status: 400 })
    const resultat = await creerRecoltes(session!.user.id, [validation.data])
    if (!resultat.ok) {
      return NextResponse.json({ error: resultat.error, ...('champ' in resultat ? { champ: resultat.champ } : {}) }, { status: 400 })
    }
    return NextResponse.json(masquerReferentielsEmbarques(resultat.recoltes[0], session!.user.id), { status: 201 })
  } catch (error) {
    console.error('POST /api/recoltes error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création de la récolte' }, { status: 500 })
  }
}
