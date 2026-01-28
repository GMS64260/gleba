/**
 * API Routes pour une Espèce spécifique
 * GET /api/especes/[id] - Détail d'une espèce
 * PUT /api/especes/[id] - Modifier une espèce
 * DELETE /api/especes/[id] - Supprimer une espèce
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateEspeceSchema } from '@/lib/validations'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/especes/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    const espece = await prisma.espece.findUnique({
      where: { id },
      include: {
        famille: true,
        varietes: {
          include: {
            fournisseur: true,
          },
        },
        itps: true,
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

    return NextResponse.json(espece)
  } catch (error) {
    console.error('GET /api/especes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'espèce' },
      { status: 500 }
    )
  }
}

// PUT /api/especes/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
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

    // Mise à jour
    const espece = await prisma.espece.update({
      where: { id },
      data: validationResult.data,
      include: {
        famille: true,
      },
    })

    return NextResponse.json(espece)
  } catch (error) {
    console.error('PUT /api/especes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'espèce' },
      { status: 500 }
    )
  }
}

// DELETE /api/especes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
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

    // Vérifier si des cultures ou récoltes sont liées
    if (espece._count.cultures > 0 || espece._count.recoltes > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer l'espèce "${id}" car elle est utilisée`,
          details: {
            cultures: espece._count.cultures,
            recoltes: espece._count.recoltes,
          }
        },
        { status: 409 }
      )
    }

    // Suppression (les variétés seront supprimées en cascade)
    await prisma.espece.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/especes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'espèce' },
      { status: 500 }
    )
  }
}
