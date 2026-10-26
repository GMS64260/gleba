import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { retournerStockCommercial } from '@/lib/commercial/stock'
import { ErreurCommerciale } from '@/lib/commercial/regles'
import { erreurCommerciale } from '@/lib/commercial/http'
import { invalidateKpi } from '@/lib/kpi'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const id = Number((await params).id)
    if (!Number.isSafeInteger(id) || id <= 0) throw new ErreurCommerciale('Facture introuvable', 404)
    const body = await request.json()
    if (body.action !== 'retourner') throw new ErreurCommerciale('Action inconnue', 400)
    await prisma.$transaction(async (tx) => {
      // Même ordre que la facturation d'un BL : documents puis facture.
      await tx.$queryRaw`SELECT id FROM documents_commerciaux WHERE user_id = ${session.user.id} AND facture_id = ${id} ORDER BY id FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM factures WHERE user_id = ${session.user.id} AND id = ${id} FOR UPDATE`
      const facture = await tx.facture.findFirst({ where: { id, userId: session.user.id } })
      if (!facture || facture.type !== 'facture') throw new ErreurCommerciale('Facture de vente introuvable', 404)
      await retournerStockCommercial(tx, session.user.id, { factureId: id })
      await tx.documentCommercial.updateMany({ where: { userId: session.user.id, factureId: id, type: 'livraison', statut: 'livre' }, data: { statut: 'retourne' } })
    }, { timeout: 30_000 })
    invalidateKpi(session.user.id)
    return NextResponse.json({ success: true })
  } catch (cause) { return erreurCommerciale(cause) }
}
