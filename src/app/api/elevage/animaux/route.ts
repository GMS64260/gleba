/**
 * API Animaux
 * GET /api/elevage/animaux - Liste des animaux
 * POST /api/elevage/animaux - Créer un animal
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
    const lotId = searchParams.get('lotId')
    const sexe = searchParams.get('sexe')

    const where: any = { userId: session.user.id }
    if (especeAnimaleId) where.especeAnimaleId = especeAnimaleId
    if (statut) where.statut = statut
    if (lotId) {
      const parsedLotId = parseInt(lotId, 10)
      if (isNaN(parsedLotId)) {
        return NextResponse.json({ error: 'lotId invalide' }, { status: 400 })
      }
      where.lotId = parsedLotId
    }
    if (sexe) where.sexe = sexe

    const animaux = await prisma.animal.findMany({
      where,
      orderBy: [{ statut: 'asc' }, { nom: 'asc' }],
      include: {
        especeAnimale: {
          select: { id: true, nom: true, type: true, couleur: true },
        },
        lot: {
          select: { id: true, nom: true },
        },
        mere: {
          select: { id: true, nom: true, identifiant: true },
        },
        _count: {
          select: {
            productionsOeufs: true,
            soins: true,
            enfants: true,
          },
        },
      },
    })

    return NextResponse.json({ data: animaux })
  } catch (error) {
    console.error('GET /api/elevage/animaux error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des animaux', details: "Erreur interne du serveur" },
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
      posX,
      posY,
      mereId,
      pereIdentifiant,
      poidsActuel,
      couleur,
      notes,
    } = body

    if (!especeAnimaleId) {
      return NextResponse.json(
        { error: 'Espèce animale requise' },
        { status: 400 }
      )
    }

    const animal = await prisma.animal.create({
      data: {
        userId: session.user.id,
        especeAnimaleId,
        lotId: lotId ? parseInt(lotId) : null,
        identifiant,
        nom,
        race,
        sexe,
        dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
        dateArrivee: dateArrivee ? new Date(dateArrivee) : new Date(),
        provenance,
        prixAchat,
        statut: statut || 'actif',
        posX,
        posY,
        mereId: mereId ? parseInt(mereId) : null,
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

    return NextResponse.json({ data: animal }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/animaux error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
