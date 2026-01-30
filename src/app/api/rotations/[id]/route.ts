/**
 * API Routes pour une Rotation specifique
 * GET /api/rotations/[id] - Detail d'une rotation
 * PUT /api/rotations/[id] - Modifier une rotation
 * DELETE /api/rotations/[id] - Supprimer une rotation
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateRotationSchema } from '@/lib/validations'
import { requireAuthApi } from '@/lib/auth-utils'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/rotations/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    const rotation = await prisma.rotation.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            itp: {
              include: {
                espece: {
                  include: {
                    famille: true,
                  },
                },
              },
            },
          },
          orderBy: { annee: 'asc' },
        },
        planches: {
          select: {
            id: true,
            ilot: true,
            longueur: true,
            largeur: true,
          },
        },
        _count: {
          select: {
            planches: true,
          },
        },
      },
    })

    if (!rotation) {
      return NextResponse.json(
        { error: `Rotation "${id}" non trouvee` },
        { status: 404 }
      )
    }

    return NextResponse.json(rotation)
  } catch (error) {
    console.error('GET /api/rotations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation de la rotation' },
      { status: 500 }
    )
  }
}

// PUT /api/rotations/[id]
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
    const validationResult = updateRotationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Verifier existence
    const existing = await prisma.rotation.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Rotation "${id}" non trouvee` },
        { status: 404 }
      )
    }

    const { details, ...rotationData } = validationResult.data

    // Calculer nbAnnees si des details sont fournis
    const nbAnnees = details && details.length > 0
      ? Math.max(...details.map(d => d.annee))
      : rotationData.nbAnnees

    // Mise a jour avec transaction pour gerer les details
    const rotation = await prisma.$transaction(async (tx) => {
      // Si des details sont fournis, supprimer les anciens et creer les nouveaux
      if (details) {
        await tx.rotationDetail.deleteMany({
          where: { rotationId: id },
        })

        for (const detail of details) {
          await tx.rotationDetail.create({
            data: {
              rotationId: id,
              annee: detail.annee,
              itpId: detail.itpId,
            },
          })
        }
      }

      // Mise a jour de la rotation
      return tx.rotation.update({
        where: { id },
        data: {
          ...rotationData,
          nbAnnees,
        },
        include: {
          details: {
            include: {
              itp: {
                include: {
                  espece: true,
                },
              },
            },
            orderBy: { annee: 'asc' },
          },
        },
      })
    })

    return NextResponse.json(rotation)
  } catch (error) {
    console.error('PUT /api/rotations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de la rotation' },
      { status: 500 }
    )
  }
}

// DELETE /api/rotations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    // Verifier existence et dependances
    const rotation = await prisma.rotation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            planches: true,
          },
        },
      },
    })

    if (!rotation) {
      return NextResponse.json(
        { error: `Rotation "${id}" non trouvee` },
        { status: 404 }
      )
    }

    // Verifier si des planches utilisent cette rotation
    if (rotation._count.planches > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer la rotation "${id}" car elle est utilisee`,
          details: {
            planches: rotation._count.planches,
          }
        },
        { status: 409 }
      )
    }

    // Suppression (les details seront supprimes en cascade)
    await prisma.rotation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (error) {
    console.error('DELETE /api/rotations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la rotation' },
      { status: 500 }
    )
  }
}
