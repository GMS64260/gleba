/**
 * API Routes pour les ITPs (Itinéraires Techniques de Plantes)
 * GET /api/itps - Liste des ITPs (referentiel global)
 * POST /api/itps - Créer un ITP
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createITPSchema } from '@/lib/validations'
import { Prisma } from '@prisma/client'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'
import { statsAvisPourRefs } from '@/lib/avis/stats-liste'
import { visibiliteReferentiel, attributionCreation } from '@/lib/referentiel-communaute'

// GET /api/itps - Référentiel global (lecture)
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

    // Visibilité catalogue communautaire : Gleba officiel (userId null) +
    // communauté (partagé par un membre) + mes propres ITP perso. Jamais le
    // perso privé d'un autre. On combine avec les filtres existants via AND.
    const whereVisible: Prisma.ITPWhereInput = {
      AND: [where, visibiliteReferentiel(userId)],
    }

    // Audit Marc 2026-05-14 — Bug 13 : "ITP Tomate hâtive serre · 3
    // cultures affichées (réel = 2)". Le `_count.cultures` était global,
    // ce qui agrégeait les cultures des autres tenants (comptes démo).
    // On filtre désormais sur l'utilisateur courant.
    const [itps, total] = await Promise.all([
      prisma.iTP.findMany({
        where: whereVisible,
        include: {
          espece: {
            include: {
              famille: true,
            },
          },
          _count: {
            select: {
              cultures: { where: { userId } },
              rotationsDetails: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      prisma.iTP.count({ where: whereVisible }),
    ])

    // Avis communautaires (opt-in via ?avis=1)
    const includeAvis = searchParams.get('avis') === '1'
    const statsMap = includeAvis
      ? await statsAvisPourRefs(prisma, 'ITP', itps.map((i) => i.id))
      : null
    const data = statsMap ? itps.map((i) => ({ ...i, avisStats: statsMap.get(i.id) })) : itps

    return NextResponse.json({
      data,
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
// - Admin : crée un ITP du catalogue Gleba officiel (userId null).
// - Utilisateur : crée un ITP perso (userId = lui), proposé à la communauté
//   (partageCommunaute=true) ou gardé privé (false).
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

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

    // Vérifier que l'espece existe si fournie + cohérence du type de culture
    // (Audit Marc Bug F : un semis_direct ne doit pas avoir de plantation,
    // sinon le trigger PG la met à NULL silencieusement — on rejette en
    // 400 plutôt avec un message clair côté UI).
    if (data.especeId) {
      // L'espèce parente doit être VISIBLE (sinon rattachement/divulgation d'un privé d'autrui).
      const espece = await prisma.espece.findFirst({
        where: { AND: [{ id: data.especeId }, visibiliteReferentiel(session!.user.id)] },
        select: { id: true, typeCultureSemis: true },
      })
      if (!espece) {
        return NextResponse.json(
          { error: `L'espèce "${data.especeId}" n'existe pas` },
          { status: 400 }
        )
      }
      if (espece.typeCultureSemis === 'semis_direct' && data.semainePlantation != null) {
        return NextResponse.json(
          {
            error: `L'espèce "${data.especeId}" est en semis direct (racine pivot ou semis en place). Le champ Plantation doit être vide.`,
          },
          { status: 400 }
        )
      }
    }

    // Création : admin → catalogue Gleba officiel ; utilisateur → perso
    // (proposé à la communauté ou privé).
    const itp = await prisma.iTP.create({
      data: {
        ...data,
        ...attributionCreation(isAdmin, session!.user.id, body.partageCommunaute === true),
      },
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
