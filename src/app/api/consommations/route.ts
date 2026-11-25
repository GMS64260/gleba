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
import { uniteConsommation } from '@/lib/stocks/consommation-unite'
import { enregistrerSortieConsommation } from '@/lib/stocks/sortie-consommation'
import { UNITES_QUANTITE, type UniteQuantite } from '@/lib/recolte/projection'
import { messageConflitStockCaisse } from '@/lib/caisse/conflit-stock'
import { periodeConsommations } from '@/lib/stocks/periode-consommations'

const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/

const consommationSchema = z.object({
  // Jour seul (« 2026-11-24 ») ou instant ISO.
  date: z.string().refine((v) => JOUR_ISO.test(v) || !Number.isNaN(Date.parse(v)), 'date invalide').optional(),
  especeId: z.string().min(1),
  quantite: z.number().positive(),
  // Unité validée contre le stock courant, puis figée sur la sortie.
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
    const periode = periodeConsommations(searchParams.get('start'), searchParams.get('end'))
    if (!periode.ok) {
      return NextResponse.json({ error: periode.error, champ: periode.champ }, { status: 400 })
    }
    const especeId = searchParams.get('espece')

    const consommations = await prisma.consommation.findMany({
      where: {
        userId: session!.user.id,
        ...(periode.date && { date: periode.date }),
        ...(especeId && { especeId })
      },
      include: {
        espece: {
          select: { id: true, nom: true, couleur: true, prixKg: true }
        },
        destination: {
          select: { id: true, description: true }
        },
        // Lots de récolte que la sortie a pris (rendus au stock si elle est annulée).
        _count: { select: { lots: true } },
      },
      orderBy: { date: 'desc' },
    })

    // Calculer stocks nets
    const stocksNet = await calculerStocksNet(session!.user.id, especeId || undefined)

    // Les anciennes lignes sans unité sont des kg, même si le stock a changé.
    return NextResponse.json({
      consommations: consommations.map((c) => ({
        ...c,
        unite: uniteConsommation(c),
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
// Une sortie prend les lots libres de l'espèce, du plus ancien au plus récent
// (`enregistrerSortieConsommation`, même règle que l'assistant et le MCP).
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

    const { date, ...data } = validated.data
    const sortie = await enregistrerSortieConsommation(session!.user.id, {
      ...data,
      date: date ? new Date(JOUR_ISO.test(date) ? `${date}T00:00:00.000Z` : date) : null,
    })
    if (!sortie.ok) {
      return NextResponse.json({ error: sortie.error, ...(sortie.champ ? { champ: sortie.champ } : {}) }, { status: sortie.status })
    }

    const consommation = await prisma.consommation.findUniqueOrThrow({
      where: { id: sortie.consommationId },
      include: {
        espece: { select: { id: true, nom: true, couleur: true, prixKg: true } },
        destination: { select: { id: true, description: true } },
      },
    })
    return NextResponse.json(
      { ...consommation, couvert: sortie.couvert, lots: sortie.lots },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/consommations error:', error)
    const conflit = messageConflitStockCaisse(error)
    if (conflit) return NextResponse.json({ error: conflit }, { status: 409 })
    return NextResponse.json(
      { error: 'Erreur lors de la création de la consommation' },
      { status: 500 }
    )
  }
}
