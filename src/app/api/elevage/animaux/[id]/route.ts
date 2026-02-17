/**
 * API Animal individuel
 * GET /api/elevage/animaux/[id] - Détails d'un animal
 * PUT /api/elevage/animaux/[id] - Modifier un animal
 * DELETE /api/elevage/animaux/[id] - Supprimer un animal
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const animal = await prisma.animal.findFirst({
      where: {
        id: parseInt(id),
        userId: session.user.id,
      },
      include: {
        especeAnimale: true,
        lot: true,
        mere: true,
        enfants: {
          select: { id: true, nom: true, identifiant: true, sexe: true, dateNaissance: true },
        },
        productionsOeufs: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        soins: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        abattages: true,
      },
    })

    if (!animal) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: animal })
  } catch (error) {
    console.error('GET /api/elevage/animaux/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    // Vérifier que l'animal appartient à l'utilisateur
    const existing = await prisma.animal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    const {
      especeAnimaleId,
      lotId,
      identifiant,
      nom,
      race,
      sexe,
      dateNaissance,
      dateArrivee,
      provenance,
      prixAchat,
      statut,
      dateSortie,
      causeSortie,
      posX,
      posY,
      mereId,
      pereIdentifiant,
      poidsActuel,
      couleur,
      notes,
    } = body

    const animal = await prisma.animal.update({
      where: { id: parseInt(id) },
      data: {
        especeAnimaleId,
        lotId: lotId !== undefined ? (lotId ? parseInt(lotId) : null) : undefined,
        identifiant,
        nom,
        race,
        sexe,
        dateNaissance: dateNaissance ? new Date(dateNaissance) : undefined,
        dateArrivee: dateArrivee ? new Date(dateArrivee) : undefined,
        provenance,
        prixAchat,
        statut,
        dateSortie: dateSortie ? new Date(dateSortie) : undefined,
        causeSortie,
        posX,
        posY,
        mereId: mereId !== undefined ? (mereId ? parseInt(mereId) : null) : undefined,
        pereIdentifiant,
        poidsActuel,
        couleur,
        notes,
      },
      include: {
        especeAnimale: true,
        lot: true,
      },
    })

    return NextResponse.json({ data: animal })
  } catch (error) {
    console.error('PUT /api/elevage/animaux/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    const existing = await prisma.animal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    await prisma.animal.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/animaux/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
