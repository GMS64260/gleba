/**
 * API Routes pour les Parcelles Géoréférencées
 * GET /api/carte - Liste des parcelles de l'utilisateur
 * POST /api/carte - Créer une nouvelle parcelle
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { createParcelleSchema } from '@/lib/validations/parcelle'
import { calculateCentroid, calculateSurfaceHa } from '@/lib/geo-utils'

// GET /api/carte - Liste des parcelles de l'utilisateur
export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const parcelles = await prisma.parcelleGeo.findMany({
      where: { userId: session!.user.id },
      select: {
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
        _count: {
          select: {
            planches: true,
            arbres: true,
            lotsAnimaux: true,
          },
        },
      },
    })

    return NextResponse.json(parcelles)
  } catch (err) {
    console.error('GET /api/carte error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des parcelles' },
      { status: 500 }
    )
  }
}

// POST /api/carte - Créer une nouvelle parcelle
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()

    // Validation Zod des champs principaux (nom, geometry, couches)
    const parsed = createParcelleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
        { status: 400 }
      )
    }

    const { nom, geometry, couches, commune, section, numero, prefixe, contenance, typeSol, usage, couleur, notes, surface: providedSurface } = parsed.data

    // Calcul automatique du centroïde
    const centroid = calculateCentroid(geometry)

    // Calcul automatique de la surface si non fournie
    const surface = providedSurface ?? calculateSurfaceHa(geometry)

    const parcelle = await prisma.parcelleGeo.create({
      data: {
        nom: nom.trim(),
        userId: session!.user.id,
        geometry,
        couches,
        centroidLat: centroid?.lat ?? null,
        centroidLng: centroid?.lng ?? null,
        surface: surface ?? null,
        commune: commune ?? null,
        section: section ?? null,
        numero: numero ?? null,
        prefixe: prefixe ?? null,
        contenance: contenance ?? null,
        typeSol: typeSol ?? null,
        usage: usage ?? null,
        couleur: couleur ?? null,
        notes: notes ?? null,
      },
      select: {
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
      },
    })

    return NextResponse.json(parcelle, { status: 201 })
  } catch (err) {
    console.error('POST /api/carte error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la création de la parcelle' },
      { status: 500 }
    )
  }
}
