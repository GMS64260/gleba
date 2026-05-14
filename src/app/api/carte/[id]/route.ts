/**
 * API Routes pour une Parcelle Géoréférencée spécifique
 * GET /api/carte/[id] - Détail d'une parcelle
 * PUT /api/carte/[id] - Modifier une parcelle
 * DELETE /api/carte/[id] - Supprimer une parcelle
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { updateParcelleSchema } from '@/lib/validations/parcelle'
import { calculateCentroid, calculateSurfaceHa } from '@/lib/geo-utils'

type RouteParams = { params: Promise<{ id: string }> }

// Sélection des champs sans les timestamps
const parcelleSelect = {
  id: true,
  nom: true,
  userId: true,
  geometry: true,
  centroidLat: true,
  centroidLng: true,
  surface: true,
  commune: true,
  section: true,
  numero: true,
  prefixe: true,
  contenance: true,
  typeSol: true,
  usage: true,
  couleur: true,
  notes: true,
  couches: true,
}

// GET /api/carte/[id] - Détail d'une parcelle
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    const parcelle = await prisma.parcelleGeo.findUnique({
      where: {
        id,
        userId: session!.user.id,
      },
      select: {
        ...parcelleSelect,
        planches: {
          select: { id: true, nom: true, surface: true, type: true, irrigation: true },
          where: { userId: session!.user.id },
        },
      },
    })

    if (!parcelle) {
      return NextResponse.json(
        { error: 'Parcelle non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json(parcelle)
  } catch (err) {
    console.error('GET /api/carte/[id] error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la parcelle' },
      { status: 500 }
    )
  }
}

// PUT /api/carte/[id] - Modifier une parcelle
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    // Vérifier existence et propriété
    const existing = await prisma.parcelleGeo.findUnique({
      where: {
        id,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Parcelle non trouvée' },
        { status: 404 }
      )
    }

    // Validation Zod des champs principaux (nom, geometry, couches — tous optionnels en update)
    const parsed = updateParcelleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      )
    }

    // Construire les données de mise à jour à partir des données validées par Zod
    const updateData: Record<string, unknown> = {}
    const d = parsed.data

    if (d.nom !== undefined) updateData.nom = d.nom.trim()
    if (d.couches !== undefined) updateData.couches = d.couches
    if (d.commune !== undefined) updateData.commune = d.commune
    if (d.section !== undefined) updateData.section = d.section
    if (d.numero !== undefined) updateData.numero = d.numero
    if (d.prefixe !== undefined) updateData.prefixe = d.prefixe
    if (d.contenance !== undefined) updateData.contenance = d.contenance
    if (d.typeSol !== undefined) updateData.typeSol = d.typeSol
    if (d.usage !== undefined) updateData.usage = d.usage
    if (d.couleur !== undefined) updateData.couleur = d.couleur
    if (d.notes !== undefined) updateData.notes = d.notes
    if (d.surface !== undefined) updateData.surface = d.surface

    // Si la géométrie change, recalculer centroïde et surface
    if (d.geometry !== undefined) {
      updateData.geometry = d.geometry

      // Recalcul automatique du centroïde
      const centroid = calculateCentroid(d.geometry)
      updateData.centroidLat = centroid?.lat ?? null
      updateData.centroidLng = centroid?.lng ?? null

      // Recalcul de la surface sauf si explicitement fournie
      if (d.surface === undefined) {
        updateData.surface = calculateSurfaceHa(d.geometry)
      }
    }

    // Mise à jour en base
    const parcelle = await prisma.parcelleGeo.update({
      where: { id },
      data: updateData,
      select: parcelleSelect,
    })

    return NextResponse.json(parcelle)
  } catch (err) {
    console.error('PUT /api/carte/[id] error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la parcelle' },
      { status: 500 }
    )
  }
}

// DELETE /api/carte/[id] - Supprimer une parcelle
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    // Vérifier existence et propriété
    const existing = await prisma.parcelleGeo.findUnique({
      where: {
        id,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Parcelle non trouvée' },
        { status: 404 }
      )
    }

    await prisma.parcelleGeo.delete({
      where: { id, userId: session!.user.id },
    })

    return NextResponse.json({ success: true, deleted: id })
  } catch (err) {
    console.error('DELETE /api/carte/[id] error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la parcelle' },
      { status: 500 }
    )
  }
}
