/**
 * API Clients
 * GET/POST/PATCH/DELETE /api/comptabilite/clients
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createClientSchema, updateClientSchema } from '@/lib/validations/client'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const actif = searchParams.get('actif')
    const search = searchParams.get('search')

    const userId = session.user.id

    const where: any = { userId }
    if (type) where.type = type
    if (actif !== null && actif !== '') where.actif = actif === 'true'
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { ville: { contains: search, mode: 'insensitive' } },
      ]
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { nom: 'asc' },
      include: {
        _count: {
          select: { ventesManuelles: true, factures: true }
        }
      }
    })

    // Stats
    const stats = await prisma.client.groupBy({
      by: ['type'],
      where: { userId, actif: true },
      _count: true,
    })

    return NextResponse.json({
      data: clients,
      stats: {
        total: clients.length,
        actifs: clients.filter(c => c.actif).length,
        parType: stats.reduce((acc, s) => ({ ...acc, [s.type]: s._count }), {}),
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/clients error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = createClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const userId = session.user.id
    const d = parsed.data

    // DEV2 #4 — Auto-dérivation SIREN depuis SIRET si non fourni.
    // Le SIREN = 9 premiers chiffres du SIRET (cf src/lib/siret.ts).
    const sirenDerived = !d.siren && d.siret ? d.siret.replace(/\s+/g, '').substring(0, 9) : d.siren

    const client = await prisma.client.create({
      data: {
        userId,
        nom: d.nom,
        type: d.type,
        email: d.email ?? null,
        telephone: d.telephone ?? null,
        adresse: d.adresse ?? null,
        ville: d.ville ?? null,
        codePostal: d.codePostal ?? null,
        pays: d.pays,
        siret: d.siret ?? null,
        siren: sirenDerived ?? null,
        tvaIntra: d.tvaIntra ?? null,
        conditionsPaiement: d.conditionsPaiement,
        exonererTVA: d.exonererTVA,
        notes: d.notes ?? null,
        actif: d.actif,
      },
    })

    return NextResponse.json({ data: client }, { status: 201 })
  } catch (error) {
    console.error('POST /api/comptabilite/clients error:', error)
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
    const parsed = updateClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { id, ...updates } = parsed.data

    const existing = await prisma.client.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 })
    }

    const updateData: any = {}
    if (updates.nom !== undefined) updateData.nom = updates.nom
    if (updates.type !== undefined) updateData.type = updates.type
    if (updates.email !== undefined) updateData.email = updates.email
    if (updates.telephone !== undefined) updateData.telephone = updates.telephone
    if (updates.adresse !== undefined) updateData.adresse = updates.adresse
    if (updates.ville !== undefined) updateData.ville = updates.ville
    if (updates.codePostal !== undefined) updateData.codePostal = updates.codePostal
    if (updates.pays !== undefined) updateData.pays = updates.pays
    if (updates.siret !== undefined) {
      updateData.siret = updates.siret
      // DEV2 #4 — auto-dériver SIREN si seulement SIRET fourni
      if (updates.siret && updates.siren === undefined) {
        updateData.siren = updates.siret.replace(/\s+/g, "").substring(0, 9)
      }
    }
    if (updates.siren !== undefined) updateData.siren = updates.siren
    if (updates.tvaIntra !== undefined) updateData.tvaIntra = updates.tvaIntra
    if (updates.conditionsPaiement !== undefined) updateData.conditionsPaiement = updates.conditionsPaiement
    if (updates.exonererTVA !== undefined) updateData.exonererTVA = updates.exonererTVA
    if (updates.notes !== undefined) updateData.notes = updates.notes
    if (updates.actif !== undefined) updateData.actif = updates.actif

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: client })
  } catch (error) {
    console.error('PATCH /api/comptabilite/clients error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification', details: "Erreur interne du serveur" },
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

    const existing = await prisma.client.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 })
    }

    // Soft delete - on désactive plutôt que supprimer
    await prisma.client.update({
      where: { id: parseInt(id) },
      data: { actif: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comptabilite/clients error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
