/**
 * API Plans de ration (GAP P0 — review caprin 2026-07-22).
 * GET ?lotId=  / POST / PATCH / DELETE?id=
 * On persiste le profil (poids, lait, TB, gestation) + la composition
 * (aliments/quantités). Les besoins/apports/coût sont recalculés côté client
 * avec les valeurs INRA courantes des aliments. Scopé userId ; l'appartenance
 * du lot/animal est validée à l'écriture (leçon IDOR review 2026-07-21).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const ligneSchema = z.object({
  alimentId: z.string().min(1),
  quantiteKg: z.coerce.number().min(0).max(10_000),
})

const rationSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(120),
  lotId: z.coerce.number().int().nullable().optional(),
  animalId: z.coerce.number().int().nullable().optional(),
  stade: z.string().max(40).default('lactation'),
  profilEspece: z.enum(['caprin', 'ovin', 'bovin', 'porcin', 'volaille', 'lapin']).default('caprin'),
  poidsVif: z.coerce.number().positive(),
  litresLait: z.coerce.number().min(0).default(0),
  tauxButyreux: z.coerce.number().min(0).default(35),
  stadeGestation: z.enum(['aucune', 'gestation_moyenne', 'gestation_finale']).default('aucune'),
  composition: z.array(ligneSchema).max(50).default([]),
  notes: z.string().max(2000).nullable().optional(),
})

// Valide que lot/animal (si fournis) appartiennent bien à l'utilisateur.
async function rationValide(
  userId: string,
  lotId: number | null | undefined,
  animalId: number | null | undefined,
  composition: Array<{ alimentId: string; quantiteKg: number }>
): Promise<string | null> {
  let lot: { id: number; especeAnimaleId: string } | null = null
  if (lotId != null) {
    lot = await prisma.lotAnimaux.findFirst({
      where: { id: lotId, userId }, select: { id: true, especeAnimaleId: true },
    })
    if (!lot) return 'Lot introuvable dans votre cheptel.'
  }
  if (animalId != null) {
    const a = await prisma.animal.findFirst({
      where: { id: animalId, userId }, select: { id: true, lotId: true, especeAnimaleId: true },
    })
    if (!a) return 'Animal introuvable dans votre cheptel.'
    if (lot && (a.lotId !== lot.id || a.especeAnimaleId !== lot.especeAnimaleId)) {
      return 'L’animal n’appartient pas au lot ciblé.'
    }
  }
  const alimentIds = [...new Set(composition.map((ligne) => ligne.alimentId))]
  if (alimentIds.length > 0) {
    const accessibles = await prisma.aliment.count({
      where: {
        id: { in: alimentIds },
        OR: [{ ownerUserId: null }, { ownerUserId: userId }],
      },
    })
    if (accessibles !== alimentIds.length) return 'Un ou plusieurs aliments sont introuvables ou privés.'
  }
  return null
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const lotId = searchParams.get('lotId')
  const where: { userId: string; lotId?: number } = { userId: session.user.id }
  if (lotId) {
    const parsedLotId = Number(lotId)
    if (!Number.isInteger(parsedLotId) || parsedLotId <= 0) {
      return NextResponse.json({ error: 'lotId invalide' }, { status: 400 })
    }
    where.lotId = parsedLotId
  }
  const rations = await prisma.planRation.findMany({ where, orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({ data: rations })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const parsed = rationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const invalide = await rationValide(session.user.id, d.lotId ?? null, d.animalId ?? null, d.composition)
    if (invalide) return NextResponse.json({ error: invalide }, { status: 400 })

    const ration = await prisma.planRation.create({
      data: {
        userId: session.user.id,
        nom: d.nom,
        lotId: d.lotId ?? null,
        animalId: d.animalId ?? null,
        stade: d.stade,
        profilEspece: d.profilEspece,
        poidsVif: d.poidsVif,
        litresLait: d.litresLait,
        tauxButyreux: d.tauxButyreux,
        stadeGestation: d.stadeGestation,
        composition: d.composition,
        notes: d.notes ?? null,
      },
    })
    return NextResponse.json({ data: ration }, { status: 201 })
  } catch (err) {
    console.error('POST /api/elevage/rations error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const body = await request.json()
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    const existing = await prisma.planRation.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
    if (!existing) return NextResponse.json({ error: 'Ration introuvable' }, { status: 404 })

    const parsed = rationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const invalide = await rationValide(session.user.id, d.lotId ?? null, d.animalId ?? null, d.composition)
    if (invalide) return NextResponse.json({ error: invalide }, { status: 400 })

    const ration = await prisma.planRation.update({
      where: { id },
      data: {
        nom: d.nom,
        lotId: d.lotId ?? null,
        animalId: d.animalId ?? null,
        stade: d.stade,
        profilEspece: d.profilEspece,
        poidsVif: d.poidsVif,
        litresLait: d.litresLait,
        tauxButyreux: d.tauxButyreux,
        stadeGestation: d.stadeGestation,
        composition: d.composition,
        notes: d.notes ?? null,
      },
    })
    return NextResponse.json({ data: ration })
  } catch (err) {
    console.error('PATCH /api/elevage/rations error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const existing = await prisma.planRation.findFirst({ where: { id, userId: session.user.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Ration introuvable' }, { status: 404 })
  await prisma.planRation.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
