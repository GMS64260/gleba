/**
 * API Soins des animaux
 * GET /api/elevage/soins - Liste des soins
 * POST /api/elevage/soins - Enregistrer un soin
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const animalId = searchParams.get('animalId')
    const lotId = searchParams.get('lotId')
    const type = searchParams.get('type')
    const fait = searchParams.get('fait')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = { userId: session.user.id }
    if (animalId) where.animalId = parseInt(animalId)
    if (lotId) where.lotId = parseInt(lotId)
    if (type) where.type = type
    if (fait !== null && fait !== undefined) where.fait = fait === 'true'

    const soins = await prisma.soinAnimal.findMany({
      where,
      orderBy: [{ fait: 'asc' }, { datePrevue: 'asc' }, { date: 'desc' }],
      take: limit,
      include: {
        animal: {
          select: { id: true, nom: true, identifiant: true },
        },
        lot: {
          select: { id: true, nom: true },
        },
      },
    })

    // Soins à venir (non faits)
    const soinsAVenir = await prisma.soinAnimal.count({
      where: {
        userId: session.user.id,
        fait: false,
      },
    })

    return NextResponse.json({
      data: soins,
      stats: {
        soinsAVenir,
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/soins error:', error)
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
    const {
      animalId,
      lotId,
      date,
      type,
      description,
      produit,
      quantite,
      unite,
      cout,
      veterinaire,
      datePrevue,
      fait,
      notes,
    } = body

    if (!type || (!animalId && !lotId)) {
      return NextResponse.json(
        { error: 'Type et animal ou lot requis' },
        { status: 400 }
      )
    }

    const soin = await prisma.soinAnimal.create({
      data: {
        userId: session.user.id,
        animalId: animalId ? parseInt(animalId) : null,
        lotId: lotId ? parseInt(lotId) : null,
        date: date ? new Date(date) : new Date(),
        type,
        description,
        produit,
        quantite: quantite ? parseFloat(quantite) : null,
        unite,
        cout: cout ? parseFloat(cout) : null,
        veterinaire,
        datePrevue: datePrevue ? new Date(datePrevue) : null,
        fait: fait !== false,
        notes,
      },
      include: {
        animal: true,
        lot: true,
      },
    })

    return NextResponse.json({ data: soin }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/soins error:', error)
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
    const { id, fait, date, notes, type, description, produit, quantite, unite, cout, datePrevue, veterinaire, animalId, lotId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.soinAnimal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Soin non trouvé' }, { status: 404 })
    }

    const updateData: any = {}
    if (fait !== undefined) updateData.fait = fait
    if (date !== undefined) updateData.date = new Date(date)
    if (notes !== undefined) updateData.notes = notes
    if (type !== undefined) updateData.type = type
    if (description !== undefined) updateData.description = description
    if (produit !== undefined) updateData.produit = produit
    if (quantite !== undefined) updateData.quantite = quantite ? parseFloat(quantite) : null
    if (unite !== undefined) updateData.unite = unite
    if (cout !== undefined) updateData.cout = cout ? parseFloat(cout) : null
    if (datePrevue !== undefined) updateData.datePrevue = datePrevue ? new Date(datePrevue) : null
    if (veterinaire !== undefined) updateData.veterinaire = veterinaire
    if (animalId !== undefined) updateData.animalId = animalId ? parseInt(animalId) : null
    if (lotId !== undefined) updateData.lotId = lotId ? parseInt(lotId) : null

    const soin = await prisma.soinAnimal.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        animal: true,
        lot: true,
      },
    })

    return NextResponse.json({ data: soin })
  } catch (error) {
    console.error('PATCH /api/elevage/soins error:', error)
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

    const existing = await prisma.soinAnimal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Soin non trouvé' }, { status: 404 })
    }

    await prisma.soinAnimal.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/soins error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
