/**
 * API Routes pour une Planche spécifique
 * GET /api/planches/[id] - Détail d'une planche
 * PUT /api/planches/[id] - Modifier une planche
 * DELETE /api/planches/[id] - Supprimer une planche
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updatePlancheSchema } from '@/lib/validations'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/planches/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    const planche = await prisma.planche.findUnique({
      where: { id },
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
      },
    })

    if (!planche) {
      return NextResponse.json(
        { error: `Planche "${id}" non trouvée` },
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

// PUT /api/planches/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validation
    const validationResult = updatePlancheSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence
    const existing = await prisma.planche.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Planche "${id}" non trouvée` },
        { status: 404 }
      )
    }

    const data = validationResult.data

    // Recalculer la surface si nécessaire
    const largeur = data.largeur ?? existing.largeur
    const longueur = data.longueur ?? existing.longueur
    const surface = largeur && longueur ? largeur * longueur : data.surface

    // Mise à jour
    const planche = await prisma.planche.update({
      where: { id },
      data: {
        ...data,
        surface,
      },
      include: {
        rotation: true,
      },
    })

    return NextResponse.json(planche)
  } catch (error) {
    console.error('PUT /api/planches/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la planche' },
      { status: 500 }
    )
  }
}

// DELETE /api/planches/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    // Vérifier existence et dépendances
    const planche = await prisma.planche.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cultures: true,
          },
        },
      },
    })

    if (!planche) {
      return NextResponse.json(
        { error: `Planche "${id}" non trouvée` },
        { status: 404 }
      )
    }

    // Vérifier si des cultures sont liées
    if (planche._count.cultures > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer la planche "${id}" car elle a des cultures`,
          details: { cultures: planche._count.cultures }
        },
        { status: 409 }
      )
    }

    // Suppression
    await prisma.planche.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/planches/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la planche' },
      { status: 500 }
    )
  }
}
