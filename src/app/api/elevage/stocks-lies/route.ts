/** GET — stocks de l'élevage qu'un produit de la boutique peut vendre. */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { listerStocksLiables } from '@/lib/boutique/stock-lie-disponible'

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error
  // Le catalogue agrège plusieurs ateliers et peut dépasser le délai par défaut de cinq secondes.
  const stocks = await prisma.$transaction((tx) => listerStocksLiables(tx, session!.user.id), { timeout: 30000 })
  return NextResponse.json(stocks, { headers: { 'Cache-Control': 'private, no-store' } })
}
