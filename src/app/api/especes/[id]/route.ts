/**
 * API Routes pour une Espèce spécifique (referentiel global)
 * GET /api/especes/[id] - Détail d'une espece
 * PUT /api/especes/[id] - Modifier une espece
 * DELETE /api/especes/[id] - Supprimer une espece
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateEspeceSchema } from '@/lib/validations'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/especes/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  let resolvedId: string | null = null
  try {
    const { id } = await params
    // Feedback Marc 2026-05-16 — Bug 04 : "Impossible de charger la fiche".
    // Le client envoie l'id encodé (encodeURIComponent) ; selon le runtime
    // (Edge vs Node, proxy Caddy en avant), `params.id` peut arriver
    // déjà décodé OU encore percent-encodé. On décode défensivement.
    resolvedId = id
    try {
      const decoded = decodeURIComponent(id)
      if (decoded !== id) resolvedId = decoded
    } catch {
      // id n'est pas percent-encodé — on garde la valeur brute.
    }

    // Visibilité : Gleba officiel + communauté + mes perso (jamais le perso privé
    // d'autrui) — sur l'espèce ET ses variétés/ITP inclus.
    const espece = await prisma.espece.findFirst({
      where: { AND: [{ id: resolvedId }, visibiliteReferentiel(userId)] },
      include: {
        famille: true,
        varietes: {
          where: visibiliteReferentiel(userId),
          include: {
            fournisseur: true,
          },
        },
        itps: { where: visibiliteReferentiel(userId) },
        _count: {
          select: {
            cultures: true,
            recoltes: true,
          },
        },
      },
    })

    if (!espece) {
      return NextResponse.json(
        { error: `Espèce "${resolvedId}" non trouvée` },
        { status: 404 }
      )
    }

    return NextResponse.json(espece)
  } catch (err) {
    console.error(`GET /api/especes/${resolvedId ?? '?'} error:`, err)
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération de l\'espèce',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

// PUT /api/especes/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params
    const body = await request.json()

    // Validation
    const validationResult = updateEspeceSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence
    const existing = await prisma.espece.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Espèce "${id}" non trouvée` },
        { status: 404 }
      )
    }

    // Seul l'auteur d'une espèce perso (ou un admin) peut la modifier.
    if (!isAdmin && existing.userId !== session!.user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que vos propres espèces.' },
        { status: 403 }
      )
    }

    // Mise à jour (l'auteur d'un perso peut basculer « proposer à la communauté »).
    const espece = await prisma.espece.update({
      where: { id },
      data: {
        ...validationResult.data,
        ...(existing.userId && body.partageCommunaute !== undefined
          ? { partageCommunaute: body.partageCommunaute === true }
          : {}),
      },
      include: {
        famille: true,
      },
    })

    return NextResponse.json(espece)
  } catch (error) {
    console.error('PUT /api/especes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'espece' },
      { status: 500 }
    )
  }
}

// DELETE /api/especes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const isAdmin = session!.user.role === 'ADMIN'

  try {
    const { id } = await params

    // Vérifier existence et dépendances
    const espece = await prisma.espece.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cultures: true,
            recoltes: true,
          },
        },
      },
    })

    if (!espece) {
      return NextResponse.json(
        { error: `Espèce "${id}" non trouvée` },
        { status: 404 }
      )
    }

    // Seul l'auteur d'une espèce perso (ou un admin) peut la supprimer.
    if (!isAdmin && espece.userId !== session!.user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que vos propres espèces.' },
        { status: 403 }
      )
    }

    // Vérifier si des cultures ou recoltes sont liées
    if (espece._count.cultures > 0 || espece._count.recoltes > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer l'espece "${id}" car elle est utilisée`,
          details: {
            cultures: espece._count.cultures,
            recoltes: espece._count.recoltes,
          }
        },
        { status: 409 }
      )
    }

    // Suppression (les varietes seront supprimées en cascade)
    await prisma.espece.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/especes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'espece' },
      { status: 500 }
    )
  }
}
