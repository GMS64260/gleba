/**
 * API Route pour la gestion des stocks (multi-tenancy via UserStock*)
 * PATCH /api/stocks - Met a jour un stock per-user
 * GET /api/stocks - Recupere tous les stocks per-user
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const body = await request.json()
    const { type, id, stock, dateStock } = body

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Type et ID requis' },
        { status: 400 }
      )
    }

    const date = dateStock ? new Date(dateStock) : new Date()

    switch (type) {
      case 'graines': {
        const userStock = await prisma.userStockVariete.upsert({
          where: { userId_varieteId: { userId, varieteId: id } },
          create: { userId, varieteId: id, stockGraines: stock, dateStock: date },
          update: { stockGraines: stock, dateStock: date },
        })
        return NextResponse.json({ success: true, data: userStock })
      }

      case 'plants': {
        const userStock = await prisma.userStockVariete.upsert({
          where: { userId_varieteId: { userId, varieteId: id } },
          create: { userId, varieteId: id, stockPlants: stock, dateStock: date },
          update: { stockPlants: stock, dateStock: date },
        })
        return NextResponse.json({ success: true, data: userStock })
      }

      case 'fertilisant': {
        const userStock = await prisma.userStockFertilisant.upsert({
          where: { userId_fertilisantId: { userId, fertilisantId: id } },
          create: { userId, fertilisantId: id, stock, dateStock: date },
          update: { stock, dateStock: date },
        })
        return NextResponse.json({ success: true, data: userStock })
      }

      case 'recolte': {
        const userStock = await prisma.userStockEspece.upsert({
          where: { userId_especeId: { userId, especeId: id } },
          create: { userId, especeId: id, inventaire: stock, dateInventaire: date },
          update: { inventaire: stock, dateInventaire: date },
        })
        return NextResponse.json({ success: true, data: userStock })
      }

      default:
        return NextResponse.json(
          { error: 'Type de stock invalide' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('PATCH /api/stocks error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour du stock', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stocks - Recupere tous les stocks per-user
 * Query params:
 *   - type: 'graines' | 'plants' | 'fertilisants' | 'recoltes' (filtre par type de stock)
 *   - especeType: 'arbres' | 'legumes' (filtre les varietes par type d'espece)
 */
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const especeType = searchParams.get('especeType')

    // Construire le filtre par type d'espece
    let especeTypeFilter: { in: string[] } | undefined
    if (especeType === 'arbres') {
      especeTypeFilter = { in: ['arbre_fruitier', 'petit_fruit'] }
    } else if (especeType === 'legumes') {
      especeTypeFilter = { in: ['legume', 'aromatique', 'engrais_vert'] }
    }

    // Helper: récupérer les stocks variétés per-user jointés avec la variété de référence
    const getVarieteStocks = async () => {
      const userStocks = await prisma.userStockVariete.findMany({
        where: {
          userId,
          ...(especeTypeFilter && {
            variete: { espece: { type: especeTypeFilter } },
          }),
        },
        include: {
          variete: {
            select: {
              id: true,
              especeId: true,
              nbGrainesG: true,
              fournisseurId: true,
            },
          },
        },
        orderBy: { variete: { especeId: 'asc' } },
      })

      return userStocks.map(us => ({
        id: us.variete.id,
        especeId: us.variete.especeId,
        stockGraines: us.stockGraines,
        stockPlants: us.stockPlants,
        dateStock: us.dateStock,
        nbGrainesG: us.variete.nbGrainesG,
        fournisseurId: us.variete.fournisseurId,
      }))
    }

    // Aussi inclure les variétés sans stock per-user (pour l'affichage complet)
    const getAllVarietes = async () => {
      const varietes = await prisma.variete.findMany({
        where: especeTypeFilter ? { espece: { type: especeTypeFilter } } : undefined,
        select: {
          id: true,
          especeId: true,
          nbGrainesG: true,
          fournisseurId: true,
          userStocks: {
            where: { userId },
            select: {
              stockGraines: true,
              stockPlants: true,
              dateStock: true,
            },
          },
        },
        orderBy: { especeId: 'asc' },
      })

      return varietes.map(v => ({
        id: v.id,
        especeId: v.especeId,
        stockGraines: v.userStocks[0]?.stockGraines ?? null,
        stockPlants: v.userStocks[0]?.stockPlants ?? null,
        dateStock: v.userStocks[0]?.dateStock ?? null,
        nbGrainesG: v.nbGrainesG,
        fournisseurId: v.fournisseurId,
      }))
    }

    if (type === 'graines' || type === 'plants') {
      const varietes = await getVarieteStocks()
      return NextResponse.json({ data: varietes })
    }

    if (type === 'fertilisants') {
      const fertilisants = await prisma.fertilisant.findMany({
        select: {
          id: true,
          type: true,
          densite: true,
          userStocks: {
            where: { userId },
            select: { stock: true, dateStock: true, prix: true },
          },
        },
        orderBy: { id: 'asc' },
      })
      return NextResponse.json({
        data: fertilisants.map(f => ({
          id: f.id,
          type: f.type,
          stock: f.userStocks[0]?.stock ?? null,
          dateStock: f.userStocks[0]?.dateStock ?? null,
          prix: f.userStocks[0]?.prix ?? null,
          densite: f.densite,
        })),
      })
    }

    if (type === 'recoltes') {
      const especes = await prisma.espece.findMany({
        where: {
          ...(especeType === 'arbres'
            ? { type: { in: ['arbre_fruitier', 'petit_fruit'] } }
            : especeType === 'legumes'
            ? { type: { in: ['legume', 'aromatique', 'engrais_vert'] } }
            : {}),
          OR: [
            { conservation: true },
            { userStocks: { some: { userId, inventaire: { not: null } } } },
          ],
        },
        select: {
          id: true,
          familleId: true,
          couleur: true,
          userStocks: {
            where: { userId },
            select: { inventaire: true, dateInventaire: true },
          },
        },
        orderBy: { id: 'asc' },
      })
      return NextResponse.json({
        data: especes.map(e => ({
          id: e.id,
          familleId: e.familleId,
          inventaire: e.userStocks[0]?.inventaire ?? null,
          dateInventaire: e.userStocks[0]?.dateInventaire ?? null,
          couleur: e.couleur,
        })),
      })
    }

    // Retourner tous les types
    const [varietes, fertilisants, especes] = await Promise.all([
      getAllVarietes(),
      prisma.fertilisant.findMany({
        select: {
          id: true,
          type: true,
          userStocks: {
            where: { userId },
            select: { stock: true, dateStock: true, prix: true },
          },
        },
        orderBy: { id: 'asc' },
      }),
      prisma.espece.findMany({
        where: {
          AND: [
            {
              OR: [
                { conservation: true },
                { userStocks: { some: { userId, inventaire: { not: null } } } },
              ],
            },
            especeType === 'arbres'
              ? { type: { in: ['arbre_fruitier', 'petit_fruit'] } }
              : especeType === 'legumes'
              ? { type: { in: ['legume', 'aromatique', 'engrais_vert'] } }
              : {},
          ],
        },
        select: {
          id: true,
          familleId: true,
          couleur: true,
          userStocks: {
            where: { userId },
            select: { inventaire: true, dateInventaire: true },
          },
        },
        orderBy: { id: 'asc' },
      }),
    ])

    return NextResponse.json({
      graines: varietes,
      plants: varietes,
      fertilisants: fertilisants.map(f => ({
        id: f.id,
        type: f.type,
        stock: f.userStocks[0]?.stock ?? null,
        dateStock: f.userStocks[0]?.dateStock ?? null,
        prix: f.userStocks[0]?.prix ?? null,
      })),
      recoltes: especes.map(e => ({
        id: e.id,
        familleId: e.familleId,
        inventaire: e.userStocks[0]?.inventaire ?? null,
        dateInventaire: e.userStocks[0]?.dateInventaire ?? null,
        couleur: e.couleur,
      })),
    })
  } catch (error) {
    console.error('GET /api/stocks error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des stocks', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
