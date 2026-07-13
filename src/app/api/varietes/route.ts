/**
 * API Routes pour les Variétés
 * GET /api/varietes - Liste des varietes (referentiel global)
 * POST /api/varietes - Créer une variete
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createVarieteSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'
import { cleanReferentielName, normalizeVarieteName } from '@/lib/normalize'
import { statsAvisPourRefs } from '@/lib/avis/stats-liste'
import { visibiliteReferentiel, attributionCreation } from '@/lib/referentiel-communaute'

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
    // avis=1 : enrichir chaque variété des stats communautaires (opt-in — coûteux,
    // ne pas l'imposer aux appelants qui n'affichent pas les avis : jardin, verger…).
    const includeAvis = searchParams.get('avis') === '1'

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
    // Visibilité : catalogue Gleba officiel (userId null) + communauté (partagé) + mes perso.
    const whereVisible: Prisma.VarieteWhereInput = {
      AND: [where, visibiliteReferentiel(userId)],
    }
    const [varietes, total] = await Promise.all([
      prisma.variete.findMany({
        where: whereVisible,
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
      prisma.variete.count({ where: whereVisible }),
    ])

    // Avis communautaires (opt-in via ?avis=1) : stats agrégées via le moteur générique.
    const statsMap = includeAvis
      ? await statsAvisPourRefs(prisma, 'VARIETE', varietes.map((v) => v.id))
      : null

    // Enrichir les varietes avec le stock per-user (+ stats communautaires si demandé)
    const enriched = varietes.map(v => {
      const userStock = v.userStocks[0]
      const { userStocks: _us, ...rest } = v
      const base = {
        ...rest,
        userStockGraines: userStock?.stockGraines ?? null,
        userStockPlants: userStock?.stockPlants ?? null,
        userStockDate: userStock?.dateStock ?? null,
      }
      if (!statsMap) return base
      return { ...base, avisStats: statsMap.get(v.id) }
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

// POST /api/varietes
// - Admin : variété du catalogue Gleba officiel (userId null).
// - Utilisateur : variété perso (userId = lui), proposée à la communauté ou privée.
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

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

    // Normalisation du nom (display) : trim, collapse whitespace, etc.
    const cleanedId = cleanReferentielName(data.id)
    if (cleanedId !== data.id) {
      data.id = cleanedId
    }

    // Clé normalisée pour la déduplication (même formule que la migration SQL
    // et l'index unique composite (espece, nom_normalise)).
    const nomNormalise = normalizeVarieteName(data.id)

    // Dédup bornée aux variétés VISIBLES (officiel + communauté + les miennes).
    const conflit = await prisma.variete.findFirst({
      where: { AND: [{ especeId: data.especeId, nomNormalise }, visibiliteReferentiel(session!.user.id)] },
      select: { id: true },
    })
    if (conflit) {
      return NextResponse.json(
        {
          error: `Une variété similaire existe déjà pour cette espèce : "${conflit.id}". Si c'est la même, utilisez-la ; sinon, choisissez un nom plus distinctif.`,
          canonique: conflit.id,
        },
        { status: 409 }
      )
    }

    // L'espèce parente doit être VISIBLE par l'utilisateur (sinon on rattacherait
    // — et divulguerait — l'espèce privée d'autrui).
    const espece = await prisma.espece.findFirst({
      where: { AND: [{ id: data.especeId }, visibiliteReferentiel(session!.user.id)] },
      select: { id: true },
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

    // Création : admin → catalogue Gleba officiel ; utilisateur → perso (proposé ou privé).
    const variete = await prisma.variete.create({
      data: {
        ...data,
        nomNormalise,
        ...attributionCreation(isAdmin, session!.user.id, body.partageCommunaute === true),
      },
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
