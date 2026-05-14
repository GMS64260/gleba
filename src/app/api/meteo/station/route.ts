/**
 * API Route Météo - Stations météo personnelles
 * GET /api/meteo/station → liste des stations de l'utilisateur
 * POST /api/meteo/station → ajouter une station
 * DELETE /api/meteo/station?id=X → supprimer une station
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi, getUserId } from '@/lib/auth-utils'

// GET /api/meteo/station
export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)

    const stations = await prisma.stationMeteo.findMany({
      where: { userId },
      select: {
        id: true,
        nom: true,
        provider: true,
        stationId: true,
        lat: true,
        lng: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: stations })
  } catch (err) {
    console.error('GET /api/meteo/station error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stations' },
      { status: 500 }
    )
  }
}

// POST /api/meteo/station
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const body = await request.json()

    const { nom, provider, stationId, apiKey, appKey, lat, lng } = body

    if (!nom || !provider || !stationId) {
      return NextResponse.json(
        { error: 'Champs nom, provider et stationId requis' },
        { status: 400 }
      )
    }

    const providersValides = ['ecowitt', 'wunderground', 'netatmo']
    if (!providersValides.includes(provider)) {
      return NextResponse.json(
        { error: `Provider invalide. Valeurs acceptées : ${providersValides.join(', ')}` },
        { status: 400 }
      )
    }

    // Validation spécifique par provider
    if (provider === 'ecowitt' && (!apiKey || !appKey)) {
      return NextResponse.json(
        { error: 'Ecowitt nécessite un apiKey et un appKey' },
        { status: 400 }
      )
    }

    if (provider === 'wunderground' && !apiKey) {
      return NextResponse.json(
        { error: 'Weather Underground nécessite un apiKey' },
        { status: 400 }
      )
    }

    const station = await prisma.stationMeteo.create({
      data: {
        userId,
        nom,
        provider,
        stationId,
        apiKey: apiKey || null,
        appKey: appKey || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
      },
      select: {
        id: true,
        nom: true,
        provider: true,
        stationId: true,
        lat: true,
        lng: true,
        active: true,
        createdAt: true,
      },
    })

    return NextResponse.json(station, { status: 201 })
  } catch (err) {
    console.error('POST /api/meteo/station error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la station' },
      { status: 500 }
    )
  }
}

// DELETE /api/meteo/station?id=X
export async function DELETE(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Paramètre id requis' },
        { status: 400 }
      )
    }

    // Vérifier que la station appartient à l'utilisateur
    const station = await prisma.stationMeteo.findFirst({
      where: { id, userId },
    })

    if (!station) {
      return NextResponse.json(
        { error: 'Station non trouvée' },
        { status: 404 }
      )
    }

    await prisma.stationMeteo.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/meteo/station error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la station' },
      { status: 500 }
    )
  }
}

// PATCH /api/meteo/station - Activer/désactiver une station
export async function PATCH(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const userId = getUserId(session)
    const body = await request.json()
    const { id, active } = body

    if (!id || typeof active !== 'boolean') {
      return NextResponse.json(
        { error: 'Paramètres id et active requis' },
        { status: 400 }
      )
    }

    const station = await prisma.stationMeteo.findFirst({
      where: { id, userId },
    })

    if (!station) {
      return NextResponse.json(
        { error: 'Station non trouvée' },
        { status: 404 }
      )
    }

    const updated = await prisma.stationMeteo.update({
      where: { id },
      data: { active },
      select: {
        id: true,
        nom: true,
        provider: true,
        stationId: true,
        active: true,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/meteo/station error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la station' },
      { status: 500 }
    )
  }
}
