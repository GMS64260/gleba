/**
 * API Routes pour une Consommation spécifique
 * DELETE /api/consommations/[id] - Supprimer une consommation
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'

type RouteParams = { params: Promise<{ id: string }> }

// DELETE /api/consommations/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const consommationId = parseInt(id)

    if (isNaN(consommationId)) {
      return NextResponse.json(
        { error: 'ID de consommation invalide' },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const consommation = await prisma.consommation.findFirst({
      where: {
        id: consommationId,
        userId: session!.user.id,
      },
    })

    if (!consommation) {
      return NextResponse.json(
        { error: `Consommation #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Suppression
    await prisma.consommation.delete({
      where: { id: consommationId },
    })

    return NextResponse.json({ success: true, deleted: consommationId })
  } catch (error) {
    console.error('DELETE /api/consommations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la consommation' },
      { status: 500 }
    )
  }
}
