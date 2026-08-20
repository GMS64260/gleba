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
import { ecrituresPassageAFait } from '@/lib/cultures/execution'
import { uniteQuantiteRecolte, type UniteQuantite } from '@/lib/recolte/projection'
import { ajouterQuantite, arrondirQuantites, partKg, type QuantiteParUnite } from '@/lib/recolte/quantites'
import { chargerSurchargesRendement, rendementEffectif } from '@/lib/recolte/rendement-effectif'

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
    ])

    const statsParUnite = arrondirQuantites(
      stats.reduce<QuantiteParUnite>(
        (acc, ligne) =>
          ajouterQuantite(acc, (ligne.unite ?? 'kg') as UniteQuantite, ligne._sum.quantite || 0),
        {},
      ),
    )

    return NextResponse.json({
      data: recoltes,
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

    // Unité de la récolte, DÉRIVÉE côté serveur du rendement effectif de
    // l'espèce chez cet utilisateur, puis FIGÉE sur la ligne (2026-08-20).
    // Dérivée et non reçue du client : personne ne doit pouvoir enregistrer
    // 120 « tiges » sur une espèce déclarée en kilos. Figée et non relue sur
    // l'espèce : une salade qui passe du kilo à la pièce ne doit pas changer le
    // sens des récoltes déjà saisies — même principe que statutBioSnapshot.
    const surcharges = await chargerSurchargesRendement(session!.user.id, [culture.especeId])
    const uniteRecolte = uniteQuantiteRecolte(
      rendementEffectif(culture.espece, surcharges.get(culture.especeId)).uniteRendement,
    )

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
          unite: uniteRecolte,
        },
        include: {
          espece: true,
          culture: true,
        },
      })

      // QA cmsw98kx1 (2026-08-16) — la saisie d'une récolte réelle marquait
      // l'étape faite en laissant Culture.dateRecolte au prévisionnel : une
      // récolte du 16/08 s'affichait « 20/09 · Fait » sur /interventions.
      // Même SSOT que le PATCH culture et bulk-fait (dateExecutionARecaler),
      // avec la date RÉELLE de récolte comme instant de référence : une
      // dateRecolte déjà passée n'est pas réécrite (historique de retard
      // préservé, les récoltes échelonnées suivantes ne bougent plus la date).
      const ecrituresRecolte = ecrituresPassageAFait(culture, 'recolteFaite', dateRecolte)
      if (!culture.recolteFaite || Object.keys(ecrituresRecolte).length > 0) {
        await tx.culture.update({
          where: { id: data.cultureId },
          data: {
            recolteFaite: true,
            ...ecrituresRecolte,
          },
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
