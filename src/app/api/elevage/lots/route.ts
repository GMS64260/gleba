/**
 * API Lots d'animaux
 * GET /api/elevage/lots - Liste des lots
 * POST /api/elevage/lots - Créer un lot
 * PATCH /api/elevage/lots - Modifier un lot
 * DELETE /api/elevage/lots - Supprimer un lot
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { lotSchema } from '@/lib/validations/elevage-lot'
import { deleteAutoEntry } from '@/lib/auto-compta'

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
        parcelleGeo: {
          select: { id: true, nom: true },
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
    const parsed = lotSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { especeAnimaleId, nom, dateArrivee, quantiteInitiale, provenance, prixAchatTotal, notes, parcelleGeoId } = parsed.data

    // Vérifier que l'espece animale existe
    const espece = await prisma.especeAnimale.findUnique({
      where: { id: especeAnimaleId },
    })
    if (!espece) {
      return NextResponse.json(
        { error: `Espèce animale "${especeAnimaleId}" introuvable` },
        { status: 400 }
      )
    }

    const lot = await prisma.lotAnimaux.create({
      data: {
        userId: session.user.id,
        especeAnimaleId,
        nom,
        dateArrivee: dateArrivee ?? new Date(),
        quantiteInitiale,
        quantiteActuelle: quantiteInitiale,
        provenance,
        prixAchatTotal,
        statut: 'actif',
        notes,
        parcelleGeoId: parcelleGeoId || null,
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
    const { id, quantiteActuelle, statut, dateReforme, notes, parcelleGeoId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.lotAnimaux.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })
    }

    const updateData: any = {}
    if (quantiteActuelle !== undefined) updateData.quantiteActuelle = parseInt(quantiteActuelle)
    if (statut !== undefined) updateData.statut = statut
    if (dateReforme !== undefined) updateData.dateReforme = dateReforme ? new Date(dateReforme) : null
    if (notes !== undefined) updateData.notes = notes
    if (parcelleGeoId !== undefined) updateData.parcelleGeoId = parcelleGeoId || null

    const lot = await prisma.lotAnimaux.update({
      where: { id: parseInt(id) },
      data: updateData,
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

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.lotAnimaux.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
      include: {
        _count: {
          select: {
            animaux: true,
            abattages: true,
            productionsOeufs: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })
    }

    // Empêcher la suppression si le lot a des dépendances actives
    const deps = existing._count
    if (deps.animaux > 0 || deps.abattages > 0 || deps.productionsOeufs > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer ce lot : il est lié à ${deps.animaux} animaux, ${deps.abattages} abattages, ${deps.productionsOeufs} productions`,
          details: deps,
        },
        { status: 409 }
      )
    }

    // Nettoyer les écritures auto-compta liées aux consommations d'aliments du lot
    try {
      await prisma.consommationAliment.deleteMany({
        where: { lotId: parseInt(id), userId: session.user.id },
      })
      await prisma.soinAnimal.deleteMany({
        where: { lotId: parseInt(id), userId: session.user.id },
      })
    } catch (cleanupError) {
      console.error('Cleanup error (lot DELETE):', cleanupError)
    }

    await prisma.lotAnimaux.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true, deleted: parseInt(id) })
  } catch (error) {
    console.error('DELETE /api/elevage/lots error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
