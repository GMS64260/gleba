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

    // Cartographie élevage — bétail présent par parcelle : lots rattachés
    // (LotAnimaux.parcelleGeoId) + animaux gérés en individuel rattachés
    // directement (Animal.parcelleGeoId). Actifs uniquement.
    const userId = session!.user.id
    const [lots, animauxIndiv] = await Promise.all([
      prisma.lotAnimaux.findMany({
        where: { userId, parcelleGeoId: { not: null }, statut: 'actif' },
        select: { id: true, nom: true, parcelleGeoId: true, quantiteActuelle: true, especeAnimale: { select: { nom: true } } },
      }),
      prisma.animal.findMany({
        where: { userId, parcelleGeoId: { not: null }, statut: 'actif' },
        select: { id: true, nom: true, identifiant: true, parcelleGeoId: true, especeAnimale: { select: { nom: true } } },
      }),
    ])

    type Agg = {
      totalTetes: number
      animauxIndividuels: number
      animaux: Array<{ id: number; nom: string | null; identifiant: string | null; espece: string }>
      lots: Array<{ id: number; nom: string | null; espece: string; quantiteActuelle: number }>
      parEspece: Record<string, number>
    }
    const parParcelle = new Map<string, Agg>()
    const ensure = (pid: string): Agg => {
      let a = parParcelle.get(pid)
      if (!a) { a = { totalTetes: 0, animauxIndividuels: 0, animaux: [], lots: [], parEspece: {} }; parParcelle.set(pid, a) }
      return a
    }
    for (const l of lots) {
      if (!l.parcelleGeoId) continue
      const a = ensure(l.parcelleGeoId)
      a.lots.push({ id: l.id, nom: l.nom, espece: l.especeAnimale.nom, quantiteActuelle: l.quantiteActuelle })
      a.totalTetes += l.quantiteActuelle
      a.parEspece[l.especeAnimale.nom] = (a.parEspece[l.especeAnimale.nom] ?? 0) + l.quantiteActuelle
    }
    for (const an of animauxIndiv) {
      if (!an.parcelleGeoId) continue
      const a = ensure(an.parcelleGeoId)
      a.animauxIndividuels += 1
      a.animaux.push({ id: an.id, nom: an.nom, identifiant: an.identifiant, espece: an.especeAnimale.nom })
      a.totalTetes += 1
      a.parEspece[an.especeAnimale.nom] = (a.parEspece[an.especeAnimale.nom] ?? 0) + 1
    }

    const withBetail = parcelles.map((p) => {
      const a = parParcelle.get(p.id)
      return {
        ...p,
        betail: a
          ? {
              totalTetes: a.totalTetes,
              animauxIndividuels: a.animauxIndividuels,
              animaux: a.animaux,
              lots: a.lots,
              parEspece: Object.entries(a.parEspece)
                .map(([espece, count]) => ({ espece, count }))
                .sort((x, y) => y.count - x.count),
            }
          : null,
      }
    })

    return NextResponse.json(withBetail)
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
