import { messageConflitStockCaisse } from '@/lib/caisse/conflit-stock'
/**
 * API Routes pour une Consommation spécifique
 * DELETE /api/consommations/[id] - Annuler une sortie : ses lots reviennent en stock
 */

import { NextRequest, NextResponse } from 'next/server'
import { annulerSortieConsommation } from '@/lib/stocks/sortie-consommation'
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

    // Les lots que la sortie avait pris reviennent en stock, puis la ligne est supprimée.
    const annulation = await annulerSortieConsommation(session!.user.id, consommationId)
    if (!annulation.ok) return NextResponse.json({ error: annulation.error }, { status: annulation.status })

    return NextResponse.json({ success: true, deleted: consommationId, lotsRendus: annulation.lotsRendus })
  } catch (error) {
    const conflitStock = messageConflitStockCaisse(error)
    if (conflitStock) return NextResponse.json({ error: conflitStock }, { status: 409 })
    console.error('DELETE /api/consommations/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la consommation' },
      { status: 500 }
    )
  }
}
