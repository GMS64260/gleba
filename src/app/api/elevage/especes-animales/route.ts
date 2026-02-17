/**
 * API Espèces Animales - Référentiel
 * GET /api/elevage/especes-animales - Liste des espèces
 * POST /api/elevage/especes-animales - Créer une espèce
 * PATCH /api/elevage/especes-animales?id=xxx - Modifier une espèce
 * DELETE /api/elevage/especes-animales?id=xxx - Supprimer une espèce
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // volaille, mammifere_petit, mammifere_grand
    const production = searchParams.get('production') // oeufs, viande, mixte

    const where: any = {}
    if (type) where.type = type
    if (production) where.production = production

    const especes = await prisma.especeAnimale.findMany({
      where,
      orderBy: { nom: 'asc' },
      include: {
        _count: {
          select: {
            animaux: true,
            lots: true,
          },
        },
      },
    })

    return NextResponse.json({ data: especes })
  } catch (error) {
    console.error('GET /api/elevage/especes-animales error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des espèces', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const {
      id,
      nom,
      type,
      production,
      dureeGestation,
      dureeCouvaison,
      dureeElevage,
      poidsAdulte,
      rendementCarcasse,
      ponteAnnuelle,
      consommationJour,
      prixAchat,
      couleur,
      description,
    } = body

    if (!id || !nom || !type || !production) {
      return NextResponse.json(
        { error: 'ID, nom, type et production sont requis' },
        { status: 400 }
      )
    }

    const espece = await prisma.especeAnimale.create({
      data: {
        id,
        nom,
        type,
        production,
        dureeGestation,
        dureeCouvaison,
        dureeElevage,
        poidsAdulte,
        rendementCarcasse,
        ponteAnnuelle,
        consommationJour,
        prixAchat,
        couleur,
        description,
      },
    })

    return NextResponse.json({ data: espece }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/elevage/especes-animales error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Une espèce avec cet ID existe déjà' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const body = await request.json()
    const {
      nom, type, production,
      dureeGestation, dureeCouvaison, dureeElevage,
      poidsAdulte, rendementCarcasse, ponteAnnuelle,
      consommationJour, prixAchat, couleur, description,
    } = body

    const data: any = {}
    if (nom !== undefined) data.nom = nom
    if (type !== undefined) data.type = type
    if (production !== undefined) data.production = production
    if (dureeGestation !== undefined) data.dureeGestation = dureeGestation
    if (dureeCouvaison !== undefined) data.dureeCouvaison = dureeCouvaison
    if (dureeElevage !== undefined) data.dureeElevage = dureeElevage
    if (poidsAdulte !== undefined) data.poidsAdulte = poidsAdulte
    if (rendementCarcasse !== undefined) data.rendementCarcasse = rendementCarcasse
    if (ponteAnnuelle !== undefined) data.ponteAnnuelle = ponteAnnuelle
    if (consommationJour !== undefined) data.consommationJour = consommationJour
    if (prixAchat !== undefined) data.prixAchat = prixAchat
    if (couleur !== undefined) data.couleur = couleur
    if (description !== undefined) data.description = description

    const espece = await prisma.especeAnimale.update({
      where: { id },
      data,
    })

    return NextResponse.json({ data: espece })
  } catch (error) {
    console.error('PATCH /api/elevage/especes-animales error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    // Vérifier qu'aucun animal/lot ne l'utilise
    const counts = await prisma.especeAnimale.findUnique({
      where: { id },
      include: { _count: { select: { animaux: true, lots: true } } },
    })

    if (!counts) {
      return NextResponse.json({ error: 'Espèce non trouvée' }, { status: 404 })
    }

    if (counts._count.animaux > 0 || counts._count.lots > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer : ${counts._count.animaux} animaux et ${counts._count.lots} lots liés` },
        { status: 409 }
      )
    }

    await prisma.especeAnimale.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/especes-animales error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
