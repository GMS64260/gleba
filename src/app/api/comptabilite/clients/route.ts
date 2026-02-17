/**
 * API Clients
 * GET/POST/PATCH/DELETE /api/comptabilite/clients
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

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
    const userId = session.user.id

    if (!body.nom) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: {
        userId,
        nom: body.nom,
        type: body.type || 'particulier',
        email: body.email || null,
        telephone: body.telephone || null,
        adresse: body.adresse || null,
        ville: body.ville || null,
        codePostal: body.codePostal || null,
        pays: body.pays || 'France',
        siret: body.siret || null,
        tvaIntra: body.tvaIntra || null,
        conditionsPaiement: body.conditionsPaiement ? parseInt(body.conditionsPaiement) : 0,
        exonererTVA: body.exonererTVA || false,
        notes: body.notes || null,
        actif: body.actif !== false,
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
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.client.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Client non trouvé' }, { status: 404 })
    }

    const client = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        ...(updateData.nom !== undefined && { nom: updateData.nom }),
        ...(updateData.type !== undefined && { type: updateData.type }),
        ...(updateData.email !== undefined && { email: updateData.email }),
        ...(updateData.telephone !== undefined && { telephone: updateData.telephone }),
        ...(updateData.adresse !== undefined && { adresse: updateData.adresse }),
        ...(updateData.ville !== undefined && { ville: updateData.ville }),
        ...(updateData.codePostal !== undefined && { codePostal: updateData.codePostal }),
        ...(updateData.pays !== undefined && { pays: updateData.pays }),
        ...(updateData.siret !== undefined && { siret: updateData.siret }),
        ...(updateData.tvaIntra !== undefined && { tvaIntra: updateData.tvaIntra }),
        ...(updateData.conditionsPaiement !== undefined && { conditionsPaiement: parseInt(updateData.conditionsPaiement) }),
        ...(updateData.exonererTVA !== undefined && { exonererTVA: updateData.exonererTVA }),
        ...(updateData.notes !== undefined && { notes: updateData.notes }),
        ...(updateData.actif !== undefined && { actif: updateData.actif }),
      },
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
