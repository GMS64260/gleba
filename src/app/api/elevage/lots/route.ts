/**
 * API Lots d'animaux
 * GET /api/elevage/lots - Liste des lots
 * POST /api/elevage/lots - Créer un lot
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const especeAnimaleId = searchParams.get('especeAnimaleId')
    const statut = searchParams.get('statut')

    const where: any = { userId: session.user.id }
    if (especeAnimaleId) where.especeAnimaleId = especeAnimaleId
    if (statut) where.statut = statut

    const lots = await prisma.lotAnimaux.findMany({
      where,
      orderBy: [{ statut: 'asc' }, { dateArrivee: 'desc' }],
      include: {
        especeAnimale: {
          select: { id: true, nom: true, type: true, couleur: true },
        },
        _count: {
          select: {
            animaux: true,
            productionsOeufs: true,
            soins: true,
          },
        },
      },
    })

    return NextResponse.json({ data: lots })
  } catch (error) {
    console.error('GET /api/elevage/lots error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des lots', details: "Erreur interne du serveur" },
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
      especeAnimaleId,
      nom,
      dateArrivee,
      quantiteInitiale,
      provenance,
      prixAchatTotal,
      notes,
    } = body

    if (!especeAnimaleId || !quantiteInitiale) {
      return NextResponse.json(
        { error: 'Espèce et quantité initiale requises' },
        { status: 400 }
      )
    }

    const lot = await prisma.lotAnimaux.create({
      data: {
        userId: session.user.id,
        especeAnimaleId,
        nom,
        dateArrivee: dateArrivee ? new Date(dateArrivee) : new Date(),
        quantiteInitiale: parseInt(quantiteInitiale),
        quantiteActuelle: parseInt(quantiteInitiale),
        provenance,
        prixAchatTotal,
        statut: 'actif',
        notes,
      },
      include: {
        especeAnimale: true,
      },
    })

    return NextResponse.json({ data: lot }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/lots error:', error)
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
    const { id, quantiteActuelle, statut, dateReforme, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.lotAnimaux.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })
    }

    const lot = await prisma.lotAnimaux.update({
      where: { id: parseInt(id) },
      data: {
        quantiteActuelle: quantiteActuelle !== undefined ? parseInt(quantiteActuelle) : undefined,
        statut,
        dateReforme: dateReforme ? new Date(dateReforme) : undefined,
        notes,
      },
      include: {
        especeAnimale: true,
      },
    })

    return NextResponse.json({ data: lot })
  } catch (error) {
    console.error('PATCH /api/elevage/lots error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
