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
import { preparerSortieStock } from '@/lib/stocks/sortie-stock'
import { UNITES_QUANTITE, type UniteQuantite } from '@/lib/recolte/projection'

const consommationSchema = z.object({
  date: z.string().datetime().optional(),
  especeId: z.string().min(1),
  quantite: z.number().positive(),
  /**
   * Unité AFFICHÉE par l'écran (QA cmvgef6ou) : contrôlée contre celle du
   * stock, jamais écrite (une consommation se compte dans l'unité du stock
   * de son espèce, cf. `src/lib/stocks/sortie-stock.ts`).
   */
  unite: z.enum(UNITES_QUANTITE as [UniteQuantite, ...UniteQuantite[]]).optional(),
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
          select: { id: true, nom: true, couleur: true, prixKg: true }
        },
        destination: {
          select: { id: true, description: true }
        }
      },
      orderBy: { date: 'desc' },
    })

    // Calculer stocks nets
    const stocksNet = await calculerStocksNet(session!.user.id, especeId || undefined)

    // Chaque sortie dans l'unité du stock de son espèce (QA cmvgef6ou) : celle
    // que le stock net lui retranche. L'écran n'a rien à deviner.
    return NextResponse.json({
      consommations: consommations.map((c) => ({
        ...c,
        unite: stocksNet[c.especeId]?.unite ?? 'kg',
      })),
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
      // Un refus de validation nomme son champ.
      const premiere = validated.error.issues[0]
      return NextResponse.json(
        {
          error: `Données invalides — ${premiere?.path.join('.') || 'corps'} : ${premiere?.message ?? 'valeur invalide'}`,
          details: validated.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { unite: uniteAffichee, ...data } = validated.data

    // Espèce visible du compte, unité du stock, quantité entière pour des
    // tiges, pièces ou bottes : règle commune avec l'assistant.
    const sortie = await preparerSortieStock(session!.user.id, {
      especeId: data.especeId,
      quantite: data.quantite,
      unite: uniteAffichee,
    })
    if (!sortie.ok) {
      return NextResponse.json({ error: sortie.error }, { status: sortie.status })
    }

    // Créer la consommation
    const consommation = await prisma.consommation.create({
      data: {
        ...data,
        especeId: sortie.especeId,
        date: data.date ? new Date(data.date) : new Date(),
        userId: session!.user.id,
      },
      include: {
        espece: {
          select: { id: true, nom: true, couleur: true, prixKg: true }
        },
        destination: {
          select: { id: true, description: true }
        }
      }
    })

    return NextResponse.json({ ...consommation, unite: sortie.unite }, { status: 201 })
  } catch (error) {
    console.error('POST /api/consommations error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la consommation' },
      { status: 500 }
    )
  }
}
