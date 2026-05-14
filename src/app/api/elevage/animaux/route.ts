/**
 * API Animaux
 * GET /api/elevage/animaux - Liste des animaux
 * POST /api/elevage/animaux - Créer un animal
 * PATCH /api/elevage/animaux - Modifier un animal
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { animalSchema } from '@/lib/validations/elevage-animal'

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
    const parsed = animalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
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
      posX,
      posY,
      mereId,
      pereIdentifiant,
      poidsActuel,
      couleur,
      notes,
    } = parsed.data

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

    // Vérifier que le lot existe si spécifié
    if (lotId) {
      const lot = await prisma.lotAnimaux.findFirst({
        where: { id: lotId, userId: session.user.id },
      })
      if (!lot) {
        return NextResponse.json(
          { error: `Lot #${lotId} introuvable` },
          { status: 400 }
        )
      }
    }

    const animal = await prisma.animal.create({
      data: {
        userId: session.user.id,
        especeAnimaleId,
        lotId: lotId ?? null,
        identifiant,
        nom,
        race,
        sexe,
        dateNaissance: dateNaissance ?? null,
        dateArrivee: dateArrivee ?? new Date(),
        provenance,
        prixAchat,
        statut,
        posX,
        posY,
        mereId: mereId ?? null,
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

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const { id, nom, race, sexe, statut, lotId, posX, posY, poidsActuel, couleur, notes, dateSortie, causeSortie } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.animal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    const updateData: any = {}
    if (nom !== undefined) updateData.nom = nom
    if (race !== undefined) updateData.race = race
    if (sexe !== undefined) updateData.sexe = sexe
    if (statut !== undefined) updateData.statut = statut
    if (lotId !== undefined) updateData.lotId = lotId ? parseInt(lotId) : null
    if (posX !== undefined) updateData.posX = posX !== null ? parseFloat(posX) : null
    if (posY !== undefined) updateData.posY = posY !== null ? parseFloat(posY) : null
    if (poidsActuel !== undefined) updateData.poidsActuel = poidsActuel ? parseFloat(poidsActuel) : null
    if (couleur !== undefined) updateData.couleur = couleur
    if (notes !== undefined) updateData.notes = notes
    if (dateSortie !== undefined) updateData.dateSortie = dateSortie ? new Date(dateSortie) : null
    if (causeSortie !== undefined) updateData.causeSortie = causeSortie

    const animal = await prisma.animal.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        especeAnimale: { select: { id: true, nom: true, type: true, couleur: true } },
        lot: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json({ data: animal })
  } catch (error) {
    console.error('PATCH /api/elevage/animaux error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
