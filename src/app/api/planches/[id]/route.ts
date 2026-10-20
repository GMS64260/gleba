/**
 * API Routes pour une Planche spécifique
 * GET /api/planches/[id] - Détail d'une planche
 * PUT /api/planches/[id] - Modifier une planche
 * DELETE /api/planches/[id] - Supprimer une planche
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { irrigationCache } from '@/lib/irrigation-cache'
import { updatePlancheSchema } from '@/lib/validations'
import { requireAuthApi } from '@/lib/auth-utils'
import { invalidateKpi } from '@/lib/kpi'
import { resoudreIdPlanche } from '@/lib/planches/resolution'
import { compterTracesPlanches, refusSuppressionPlanche } from '@/lib/planches/traces'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/planches/[id]
// Le paramètre est l'identifiant de la planche ; son nom reste accepté en
// repli pour les liens et favoris antérieurs (cf. lib/planches/resolution).
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const reference = decodeURIComponent(id)
    const plancheId = await resoudreIdPlanche(prisma, reference, session!.user.id)

    const planche = plancheId ? await prisma.planche.findUnique({
      where: { id: plancheId },
      include: {
        rotation: {
          include: {
            details: {
              include: { itp: true },
              orderBy: { annee: 'asc' },
            },
          },
        },
        cultures: {
          include: {
            espece: true,
            variete: true,
          },
          orderBy: { annee: 'desc' },
          take: 20,
        },
        fertilisations: {
          include: { fertilisant: true },
          orderBy: { date: 'desc' },
          take: 10,
        },
        analyses: {
          orderBy: { dateAnalyse: 'desc' },
          take: 5,
        },
        parcelleGeo: {
          select: { id: true, nom: true, surface: true, centroidLat: true, centroidLng: true },
        },
      },
    }) : null

    if (!planche) {
      return NextResponse.json(
        { error: `Planche "${reference}" non trouvée` },
        { status: 404 }
      )
    }

    return NextResponse.json(planche)
  } catch (error) {
    console.error('GET /api/planches/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la planche' },
      { status: 500 }
    )
  }
}

// PUT /api/planches/[id] — identifiant, ou nom en repli.
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const reference = decodeURIComponent(id)
    const body = await request.json()

    // Validation
    const validationResult = updatePlancheSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const plancheId = await resoudreIdPlanche(prisma, reference, session!.user.id)
    const existing = plancheId
      ? await prisma.planche.findUnique({ where: { id: plancheId } })
      : null

    if (!existing) {
      return NextResponse.json(
        { error: `Planche "${reference}" non trouvée` },
        { status: 404 }
      )
    }

    const data = validationResult.data

    // Renommage : l'unicité (nom, userId) est une contrainte SQL. On la teste
    // avant l'update pour renvoyer un message compréhensible plutôt qu'un
    // échec Prisma générique.
    if (data.nom !== undefined && data.nom !== existing.nom) {
      const collision = await prisma.planche.findUnique({
        where: { nom_userId: { nom: data.nom, userId: session!.user.id } },
        select: { id: true },
      })
      if (collision) {
        return NextResponse.json(
          { error: `Vous avez déjà une planche nommée « ${data.nom} ».` },
          { status: 409 }
        )
      }
    }

    // Recalculer la surface si necessaire
    const largeur = data.largeur ?? existing.largeur
    const longueur = data.longueur ?? existing.longueur
    const surface = largeur && longueur ? largeur * longueur : data.surface

    // Mise à jour
    const planche = await prisma.planche.update({
      where: { id: existing.id },
      data: {
        ...data,
        surface,
      },
      include: {
        rotation: true,
        parcelleGeo: {
          select: { id: true, nom: true, surface: true, centroidLat: true, centroidLng: true },
        },
      },
    })

    invalidateKpi(session!.user.id)
    // Sol et système d'arrosage de la planche nourrissent le conseil d'irrigation.
    irrigationCache.invalidateUser(session!.user.id)
    return NextResponse.json(planche)
  } catch (error) {
    console.error('PUT /api/planches/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la planche' },
      { status: 500 }
    )
  }
}

// DELETE /api/planches/[id] — identifiant, ou nom en repli.
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const reference = decodeURIComponent(id)

    // Vérifier existence, propriété et dépendances
    const plancheId = await resoudreIdPlanche(prisma, reference, session!.user.id)
    const planche = plancheId ? await prisma.planche.findUnique({
      where: { id: plancheId },
      select: { id: true, nom: true },
    }) : null

    if (!planche) {
      return NextResponse.json(
        { error: `Planche "${reference}" non trouvée` },
        { status: 404 }
      )
    }

    // QA cmv29i9ad — cultures et interventions retiennent la planche, sinon
    // l'intervention perd son emplacement (voir traces.ts pour ce qui ne la
    // retient pas).
    // QA cmvgdp9fn — le refus nomme les années des cultures et porte un lien
    // vers la liste filtrée ; l'écran l'affiche tel quel.
    const traces = (await compterTracesPlanches(prisma, [planche], session!.user.id)).get(planche.id)!
    const refus = refusSuppressionPlanche(planche, traces)
    if (refus) {
      return NextResponse.json(refus, { status: 409 })
    }

    // Suppression
    await prisma.planche.delete({
      where: { id: planche.id },
    })

    invalidateKpi(session!.user.id)
    return NextResponse.json({ success: true, deleted: planche.nom, deletedId: planche.id })
  } catch (error) {
    console.error('DELETE /api/planches/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la planche' },
      { status: 500 }
    )
  }
}
