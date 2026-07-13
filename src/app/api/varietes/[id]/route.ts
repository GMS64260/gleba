/**
 * API Routes pour une Variété spécifique (referentiel global)
 * PUT /api/varietes/[id] - Modifier une variete
 * DELETE /api/varietes/[id] - Supprimer une variete
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateVarieteSchema } from '@/lib/validations'
import { requireAuthApi, requireAdminApi } from '@/lib/auth-utils'

type RouteParams = { params: Promise<{ id: string }> }

// PUT /api/varietes/[id]
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
    const validationResult = updateVarieteSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence
    const existing = await prisma.variete.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Variété "${id}" non trouvée` },
        { status: 404 }
      )
    }

    // Seul l'auteur d'une variété perso (ou un admin) peut la modifier.
    if (!isAdmin && existing.userId !== session!.user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez modifier que vos propres variétés.' },
        { status: 403 }
      )
    }

    // Vérifier que le fournisseur existe si fourni
    if (validationResult.data.fournisseurId) {
      const fournisseur = await prisma.fournisseur.findUnique({
        where: { id: validationResult.data.fournisseurId },
      })
      if (!fournisseur) {
        return NextResponse.json(
          { error: `Le fournisseur "${validationResult.data.fournisseurId}" n'existe pas` },
          { status: 400 }
        )
      }
    }

    // Mise à jour (l'auteur d'un perso peut basculer « proposer à la communauté »).
    const variete = await prisma.variete.update({
      where: { id },
      data: {
        ...validationResult.data,
        ...(existing.userId && body.partageCommunaute !== undefined
          ? { partageCommunaute: body.partageCommunaute === true }
          : {}),
      },
      include: {
        espece: true,
        fournisseur: true,
      },
    })

    return NextResponse.json(variete)
  } catch (error) {
    console.error('PUT /api/varietes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la variété' },
      { status: 500 }
    )
  }
}

// DELETE /api/varietes/[id]
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
    const variete = await prisma.variete.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cultures: true,
          },
        },
      },
    })

    if (!variete) {
      return NextResponse.json(
        { error: `Variété "${id}" non trouvée` },
        { status: 404 }
      )
    }

    // Seul l'auteur d'une variété perso (ou un admin) peut la supprimer.
    if (!isAdmin && variete.userId !== session!.user.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez supprimer que vos propres variétés.' },
        { status: 403 }
      )
    }

    // Vérifier si des cultures sont liées
    if (variete._count.cultures > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer la variete "${id}" car elle est utilisée par ${variete._count.cultures} culture(s)`,
          details: { cultures: variete._count.cultures },
        },
        { status: 409 }
      )
    }

    await prisma.variete.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/varietes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la variété' },
      { status: 500 }
    )
  }
}
