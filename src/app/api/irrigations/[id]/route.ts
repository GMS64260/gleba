/**
 * API Routes pour une irrigation spécifique
 * GET /api/irrigations/[id] - Détails
 * PATCH /api/irrigations/[id] - Mettre à jour
 * DELETE /api/irrigations/[id] - Supprimer
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'

// GET /api/irrigations/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { id: idStr } = await params
    const id = parseInt(idStr)

    const irrigation = await prisma.irrigationPlanifiee.findFirst({
      where: { id, userId },
      include: {
        culture: {
          include: {
            espece: true,
          },
        },
      },
    })

    if (!irrigation) {
      return NextResponse.json(
        { error: 'Irrigation non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json(irrigation)
  } catch (error) {
    console.error('GET /api/irrigations/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'irrigation" },
      { status: 500 }
    )
  }
}

// PATCH /api/irrigations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { id: idStr } = await params
    const id = parseInt(idStr)
    const body = await request.json()

    // Vérifier que l'irrigation appartient à l'utilisateur
    const existing = await prisma.irrigationPlanifiee.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Irrigation non trouvée' },
        { status: 404 }
      )
    }

    const { fait, dateEffective, datePrevue, notes } = body

    const updateData: any = {}

    if (typeof fait === 'boolean') {
      updateData.fait = fait
      // Si on marque comme fait et pas de date effective, utiliser aujourd'hui
      if (fait && !dateEffective && !existing.dateEffective) {
        updateData.dateEffective = new Date()
      }
    }

    if (dateEffective !== undefined) {
      updateData.dateEffective = dateEffective ? new Date(dateEffective) : null
    }

    if (datePrevue !== undefined) {
      updateData.datePrevue = new Date(datePrevue)
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    const irrigation = await prisma.irrigationPlanifiee.update({
      where: { id },
      data: updateData,
      include: {
        culture: {
          include: {
            espece: true,
          },
        },
      },
    })

    return NextResponse.json(irrigation)
  } catch (error) {
    console.error('PATCH /api/irrigations/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'irrigation" },
      { status: 500 }
    )
  }
}

// DELETE /api/irrigations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { id: idStr } = await params
    const id = parseInt(idStr)

    // Vérifier que l'irrigation appartient à l'utilisateur
    const existing = await prisma.irrigationPlanifiee.findFirst({
      where: { id, userId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Irrigation non trouvée' },
        { status: 404 }
      )
    }

    await prisma.irrigationPlanifiee.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/irrigations/[id] error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'irrigation" },
      { status: 500 }
    )
  }
}
