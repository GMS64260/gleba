/**
 * API Routes pour les Consommations
 * GET /api/consommations - Liste des sorties de stock
 * POST /api/consommations - Créer une sortie
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { z } from 'zod'
import { calculerStocksNet } from '@/lib/stocks-helpers'

const consommationSchema = z.object({
  date: z.string().datetime().optional(),
  especeId: z.string().min(1),
  quantite: z.number().positive(),
  prix: z.number().min(0).optional(),
  destinationId: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

// GET /api/consommations
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const especeId = searchParams.get('espece')

    const consommations = await prisma.consommation.findMany({
      where: {
        userId: session!.user.id,
        ...(start && end && {
          date: { gte: new Date(start), lte: new Date(end) }
        }),
        ...(especeId && { especeId })
      },
      include: {
        espece: {
          select: { id: true, couleur: true, prixKg: true }
        },
        destination: {
          select: { id: true, description: true }
        }
      },
      orderBy: { date: 'desc' },
    })

    // Calculer stocks nets
    const stocksNet = await calculerStocksNet(session!.user.id, especeId || undefined)

    return NextResponse.json({
      consommations,
      stocksNet,
    })
  } catch (error) {
    console.error('GET /api/consommations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des consommations' },
      { status: 500 }
    )
  }
}

// POST /api/consommations
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation
    const validated = consommationSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validated.error.flatten() },
        { status: 400 }
      )
    }

    const data = validated.data

    // Vérifier que l'espèce existe
    const espece = await prisma.espece.findUnique({
      where: { id: data.especeId }
    })

    if (!espece) {
      return NextResponse.json(
        { error: `Espèce "${data.especeId}" introuvable` },
        { status: 404 }
      )
    }

    // Créer la consommation
    const consommation = await prisma.consommation.create({
      data: {
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
        userId: session!.user.id,
      },
      include: {
        espece: {
          select: { id: true, couleur: true, prixKg: true }
        },
        destination: {
          select: { id: true, description: true }
        }
      }
    })

    return NextResponse.json(consommation, { status: 201 })
  } catch (error) {
    console.error('POST /api/consommations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la consommation' },
      { status: 500 }
    )
  }
}
