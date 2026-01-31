/**
 * API Route pour la gestion des stocks
 * PATCH /api/stocks - Met a jour un stock
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
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
        const variete = await prisma.variete.update({
          where: { id },
          data: { stockGraines: stock, dateStock: date },
        })
        return NextResponse.json({ success: true, data: variete })
      }

      case 'plants': {
        const variete = await prisma.variete.update({
          where: { id },
          data: { stockPlants: stock, dateStock: date },
        })
        return NextResponse.json({ success: true, data: variete })
      }

      case 'fertilisant': {
        const fertilisant = await prisma.fertilisant.update({
          where: { id },
          data: { stock, dateStock: date },
        })
        return NextResponse.json({ success: true, data: fertilisant })
      }

      case 'recolte': {
        const espece = await prisma.espece.update({
          where: { id },
          data: { inventaire: stock, dateInventaire: date },
        })
        return NextResponse.json({ success: true, data: espece })
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
      { error: 'Erreur lors de la mise a jour du stock', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/stocks - Recupere tous les stocks
 */
export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'graines') {
      const varietes = await prisma.variete.findMany({
        select: {
          id: true,
          especeId: true,
          stockGraines: true,
          dateStock: true,
          nbGrainesG: true,
          fournisseurId: true,
        },
        orderBy: { especeId: 'asc' },
      })
      return NextResponse.json({ data: varietes })
    }

    if (type === 'plants') {
      const varietes = await prisma.variete.findMany({
        select: {
          id: true,
          especeId: true,
          stockPlants: true,
          dateStock: true,
          fournisseurId: true,
        },
        orderBy: { especeId: 'asc' },
      })
      return NextResponse.json({ data: varietes })
    }

    if (type === 'fertilisants') {
      const fertilisants = await prisma.fertilisant.findMany({
        select: {
          id: true,
          type: true,
          stock: true,
          dateStock: true,
          prix: true,
          densite: true,
        },
        orderBy: { id: 'asc' },
      })
      return NextResponse.json({ data: fertilisants })
    }

    if (type === 'recoltes') {
      const especes = await prisma.espece.findMany({
        where: { inventaire: { not: null } },
        select: {
          id: true,
          familleId: true,
          inventaire: true,
          dateInventaire: true,
          couleur: true,
        },
        orderBy: { id: 'asc' },
      })
      return NextResponse.json({ data: especes })
    }

    // Retourner tous les types (toutes les varietes, pas seulement celles avec stock)
    const [varietes, fertilisants, especes] = await Promise.all([
      prisma.variete.findMany({
        select: {
          id: true,
          especeId: true,
          stockGraines: true,
          stockPlants: true,
          dateStock: true,
          nbGrainesG: true,
          fournisseurId: true,
        },
        orderBy: { especeId: 'asc' },
      }),
      prisma.fertilisant.findMany({
        select: {
          id: true,
          type: true,
          stock: true,
          dateStock: true,
          prix: true,
        },
        orderBy: { id: 'asc' },
      }),
      prisma.espece.findMany({
        where: {
          OR: [
            { conservation: true }, // Especes qui se conservent
            { inventaire: { not: null } }, // Ou qui ont deja un inventaire
          ],
        },
        select: {
          id: true,
          familleId: true,
          inventaire: true,
          dateInventaire: true,
          couleur: true,
        },
        orderBy: { id: 'asc' },
      }),
    ])

    return NextResponse.json({
      graines: varietes,
      plants: varietes,
      fertilisants,
      recoltes: especes,
    })
  } catch (error) {
    console.error('GET /api/stocks error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des stocks', details: String(error) },
      { status: 500 }
    )
  }
}
