/**
 * API Production d'œufs
 * GET /api/elevage/production-oeufs - Liste des productions
 * POST /api/elevage/production-oeufs - Enregistrer une production
 * PATCH /api/elevage/production-oeufs - Modifier une production
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const lotId = searchParams.get('lotId')
    const animalId = searchParams.get('animalId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = { userId: session.user.id }
    if (lotId) where.lotId = parseInt(lotId)
    if (animalId) where.animalId = parseInt(animalId)
    if (dateDebut || dateFin) {
      where.date = {}
      if (dateDebut) where.date.gte = new Date(dateDebut)
      if (dateFin) where.date.lte = new Date(dateFin)
    }

    const productions = await prisma.productionOeuf.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        lot: {
          select: { id: true, nom: true },
        },
        animal: {
          select: { id: true, nom: true, identifiant: true },
        },
      },
    })

    // Stats agrégées
    const stats = await prisma.productionOeuf.aggregate({
      where,
      _sum: {
        quantite: true,
        casses: true,
        sales: true,
      },
      _count: true,
    })

    return NextResponse.json({
      data: productions,
      stats: {
        total: stats._sum.quantite || 0,
        casses: stats._sum.casses || 0,
        sales: stats._sum.sales || 0,
        nbEnregistrements: stats._count,
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/production-oeufs error:', error)
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
    const body = await request.json()
    const { lotId, animalId, date, quantite, casses, sales, calibre, notes } = body

    if (!quantite || (!lotId && !animalId)) {
      return NextResponse.json(
        { error: 'Quantité et lot ou animal requis' },
        { status: 400 }
      )
    }

    const production = await prisma.productionOeuf.create({
      data: {
        userId: session.user.id,
        lotId: lotId ? parseInt(lotId) : null,
        animalId: animalId ? parseInt(animalId) : null,
        date: date ? new Date(date) : new Date(),
        quantite: parseInt(quantite),
        casses: casses ? parseInt(casses) : 0,
        sales: sales ? parseInt(sales) : 0,
        calibre,
        notes,
      },
      include: {
        lot: true,
        animal: true,
      },
    })

    return NextResponse.json({ data: production }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/production-oeufs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const { id, date, quantite, casses, sales, calibre, notes, lotId, animalId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.productionOeuf.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Production non trouvée' }, { status: 404 })
    }

    const updateData: any = {}
    if (date !== undefined) updateData.date = new Date(date)
    if (quantite !== undefined) updateData.quantite = parseInt(quantite)
    if (casses !== undefined) updateData.casses = parseInt(casses)
    if (sales !== undefined) updateData.sales = parseInt(sales)
    if (calibre !== undefined) updateData.calibre = calibre
    if (notes !== undefined) updateData.notes = notes
    if (lotId !== undefined) updateData.lotId = lotId ? parseInt(lotId) : null
    if (animalId !== undefined) updateData.animalId = animalId ? parseInt(animalId) : null

    const production = await prisma.productionOeuf.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        lot: { select: { id: true, nom: true } },
        animal: { select: { id: true, nom: true, identifiant: true } },
      },
    })

    return NextResponse.json({ data: production })
  } catch (error) {
    console.error('PATCH /api/elevage/production-oeufs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.productionOeuf.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Production non trouvée' }, { status: 404 })
    }

    await prisma.productionOeuf.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/production-oeufs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
