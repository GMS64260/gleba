/**
 * GET /api/user/stocks/varietes
 *
 * Endpoint léger consommé par le bandeau "Premiers pas" (maraîchage)
 * pour savoir si l'utilisateur a déjà saisi au moins un stock de
 * variété (graines, plants, caïeux, etc.). Permet de cocher l'étape
 * "Saisir votre stock de semences / plants" sans avoir à charger
 * l'inventaire complet.
 *
 * Query :
 *   - limit : limite optionnelle (utilisée par la banner avec limit=1)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10) || 1)) : undefined

    const rows = await prisma.userStockVariete.findMany({
      where: {
        userId,
        OR: [
          { stockGraines: { gt: 0 } },
          { stockPlants: { gt: 0 } },
        ],
      },
      take: limit,
      select: {
        varieteId: true,
        stockGraines: true,
        stockPlants: true,
        uniteStock: true,
        dateStock: true,
      },
    })

    return NextResponse.json({ data: rows })
  } catch (err) {
    console.error('GET /api/user/stocks/varietes error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stocks variétés' },
      { status: 500 }
    )
  }
}
