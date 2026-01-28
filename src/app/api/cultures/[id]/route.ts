/**
 * API Routes pour une Culture spécifique
 * GET /api/cultures/[id] - Détail d'une culture
 * PUT /api/cultures/[id] - Modifier une culture
 * DELETE /api/cultures/[id] - Supprimer une culture
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateCultureSchema } from '@/lib/validations'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/cultures/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const cultureId = parseInt(id)

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    const culture = await prisma.culture.findUnique({
      where: { id: cultureId },
      include: {
        espece: {
          include: { famille: true },
        },
        variete: {
          include: { fournisseur: true },
        },
        itp: true,
        planche: {
          include: { rotation: true },
        },
        recoltes: {
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!culture) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Ajouter les champs calculés
    const cultureWithComputed = {
      ...culture,
      etat: culture.terminee
        ? 'Terminée'
        : culture.recolteFaite
          ? 'En récolte'
          : culture.plantationFaite
            ? 'Plantée'
            : culture.semisFait
              ? 'Semée'
              : 'Planifiée',
      totalRecolte: culture.recoltes.reduce((sum, r) => sum + r.quantite, 0),
    }

    return NextResponse.json(cultureWithComputed)
  } catch (error) {
    console.error('GET /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la culture' },
      { status: 500 }
    )
  }
}

// PUT /api/cultures/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const cultureId = parseInt(id)
    const body = await request.json()

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    // Validation
    const validationResult = updateCultureSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence
    const existing = await prisma.culture.findUnique({
      where: { id: cultureId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Mise à jour
    const culture = await prisma.culture.update({
      where: { id: cultureId },
      data: validationResult.data,
      include: {
        espece: true,
        variete: true,
        itp: true,
        planche: true,
      },
    })

    return NextResponse.json(culture)
  } catch (error) {
    console.error('PUT /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la culture' },
      { status: 500 }
    )
  }
}

// DELETE /api/cultures/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const cultureId = parseInt(id)

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    // Vérifier existence
    const culture = await prisma.culture.findUnique({
      where: { id: cultureId },
    })

    if (!culture) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Suppression (les récoltes seront supprimées en cascade)
    await prisma.culture.delete({
      where: { id: cultureId },
    })

    return NextResponse.json({ success: true, deleted: cultureId })
  } catch (error) {
    console.error('DELETE /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la culture' },
      { status: 500 }
    )
  }
}
