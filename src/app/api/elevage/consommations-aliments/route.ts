/**
 * API Consommations d'aliments (élevage)
 * GET /api/elevage/consommations-aliments - Liste avec filtres
 * POST /api/elevage/consommations-aliments - Créer + décrémenter stock
 * DELETE /api/elevage/consommations-aliments - Supprimer + ré-incrémenter stock
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { consommationAlimentSchema } from '@/lib/validations/consommation-aliment'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const alimentId = searchParams.get('alimentId')
    const lotId = searchParams.get('lotId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = { userId }
    if (alimentId) where.alimentId = alimentId
    if (lotId) where.lotId = parseInt(lotId)
    if (dateDebut || dateFin) {
      where.date = {}
      if (dateDebut) where.date.gte = new Date(dateDebut)
      if (dateFin) where.date.lte = new Date(dateFin)
    }

    const consommations = await prisma.consommationAliment.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        aliment: {
          select: { id: true, nom: true, type: true },
        },
        lot: {
          select: { id: true, nom: true },
        },
      },
    })

    // Stats agrégées
    const stats = await prisma.consommationAliment.aggregate({
      where,
      _sum: { quantite: true },
      _count: true,
    })

    // Répartition par aliment
    const parAliment = await prisma.consommationAliment.groupBy({
      by: ['alimentId'],
      where,
      _sum: { quantite: true },
      _count: true,
    })

    // Récupérer les noms d'aliments
    const alimentIds = parAliment.map(a => a.alimentId)
    const aliments = await prisma.aliment.findMany({
      where: { id: { in: alimentIds } },
      select: { id: true, nom: true },
    })
    const alimentMap = new Map(aliments.map(a => [a.id, a.nom]))

    return NextResponse.json({
      data: consommations,
      stats: {
        totalKg: stats._sum.quantite || 0,
        nbEnregistrements: stats._count,
        parAliment: parAliment.map(a => ({
          alimentId: a.alimentId,
          nom: alimentMap.get(a.alimentId) || a.alimentId,
          totalKg: a._sum.quantite || 0,
          count: a._count,
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/consommations-aliments error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const body = await request.json()

    // Validation
    const result = consommationAlimentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { alimentId, lotId, date, quantite, notes } = result.data

    // Transaction : créer la consommation + décrémenter le stock
    const [consommation] = await prisma.$transaction([
      prisma.consommationAliment.create({
        data: {
          userId,
          alimentId,
          lotId: lotId ?? null,
          date,
          quantite,
          notes: notes ?? null,
        },
        include: {
          aliment: { select: { id: true, nom: true, type: true } },
          lot: { select: { id: true, nom: true } },
        },
      }),
      // Décrémenter le stock per-user
      prisma.userStockAliment.upsert({
        where: { userId_alimentId: { userId, alimentId } },
        create: {
          userId,
          alimentId,
          stock: -quantite, // Commence négatif si pas de stock initial
          dateStock: new Date(),
        },
        update: {
          stock: { decrement: quantite },
          dateStock: new Date(),
        },
      }),
    ])

    return NextResponse.json({ data: consommation }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/consommations-aliments error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const consId = parseInt(id)

    // Vérifier ownership et récupérer les données
    const existing = await prisma.consommationAliment.findFirst({
      where: { id: consId, userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Consommation non trouvée' }, { status: 404 })
    }

    // Transaction : supprimer + ré-incrémenter le stock
    await prisma.$transaction([
      prisma.consommationAliment.delete({
        where: { id: consId },
      }),
      // Ré-incrémenter le stock per-user
      prisma.userStockAliment.upsert({
        where: { userId_alimentId: { userId, alimentId: existing.alimentId } },
        create: {
          userId,
          alimentId: existing.alimentId,
          stock: existing.quantite,
          dateStock: new Date(),
        },
        update: {
          stock: { increment: existing.quantite },
          dateStock: new Date(),
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/consommations-aliments error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
