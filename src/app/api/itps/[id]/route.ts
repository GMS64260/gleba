/**
 * API Routes pour un ITP spécifique (référentiel global)
 * GET /api/itps/[id] - Détail d'un ITP
 * PUT /api/itps/[id] - Modifier un ITP
 * DELETE /api/itps/[id] - Supprimer un ITP
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateITPSchema } from '@/lib/validations'
import { requireAuthApi } from '@/lib/auth-utils'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/itps/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    const itp = await prisma.iTP.findUnique({
      where: { id },
      include: {
        espece: {
          include: {
            famille: true,
          },
        },
        _count: {
          select: {
            cultures: true,
            rotationsDetails: true,
          },
        },
      },
    })

    if (!itp) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé` },
        { status: 404 }
      )
    }

    return NextResponse.json(itp)
  } catch (error) {
    console.error('GET /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'ITP' },
      { status: 500 }
    )
  }
}

// PUT /api/itps/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    // Validation
    const validationResult = updateITPSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence
    const existing = await prisma.iTP.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé` },
        { status: 404 }
      )
    }

    const data = validationResult.data

    // Vérifier que l'espèce existe si fournie
    if (data.especeId) {
      const espece = await prisma.espece.findUnique({
        where: { id: data.especeId },
      })
      if (!espece) {
        return NextResponse.json(
          { error: `L'espèce "${data.especeId}" n'existe pas` },
          { status: 400 }
        )
      }
    }

    // Mise à jour
    const itp = await prisma.iTP.update({
      where: { id },
      data,
      include: {
        espece: true,
      },
    })

    return NextResponse.json(itp)
  } catch (error) {
    console.error('PUT /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'ITP' },
      { status: 500 }
    )
  }
}

// DELETE /api/itps/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    // Vérifier existence et dépendances
    const itp = await prisma.iTP.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cultures: true,
            rotationsDetails: true,
          },
        },
      },
    })

    if (!itp) {
      return NextResponse.json(
        { error: `ITP "${id}" non trouvé` },
        { status: 404 }
      )
    }

    // Vérifier si des cultures ou rotations sont liées
    if (itp._count.cultures > 0 || itp._count.rotationsDetails > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer l'ITP "${id}" car il est utilisé`,
          details: {
            cultures: itp._count.cultures,
            rotations: itp._count.rotationsDetails,
          }
        },
        { status: 409 }
      )
    }

    // Suppression
    await prisma.iTP.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/itps/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'ITP' },
      { status: 500 }
    )
  }
}
