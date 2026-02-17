/**
 * API Fournisseurs
 * GET/POST/PATCH/DELETE /api/comptabilite/fournisseurs
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

    const where: any = {}
    if (type) where.type = type
    if (actif !== null && actif !== '') where.actif = actif === 'true'
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
        { ville: { contains: search, mode: 'insensitive' } },
      ]
    }

    const fournisseurs = await prisma.fournisseur.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        _count: {
          select: { varietes: true, aliments: true }
        }
      }
    })

    // Stats
    const stats = await prisma.fournisseur.groupBy({
      by: ['type'],
      where: { actif: true },
      _count: true,
    })

    return NextResponse.json({
      data: fournisseurs,
      stats: {
        total: fournisseurs.length,
        actifs: fournisseurs.filter(f => f.actif).length,
        parType: stats.reduce((acc, s) => ({ ...acc, [s.type || 'autre']: s._count }), {}),
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/fournisseurs error:', error)
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

    if (!body.id) {
      return NextResponse.json({ error: 'Nom/ID requis' }, { status: 400 })
    }

    // Vérifier si existe déjà
    const existing = await prisma.fournisseur.findUnique({
      where: { id: body.id },
    })

    if (existing) {
      return NextResponse.json({ error: 'Ce fournisseur existe déjà' }, { status: 400 })
    }

    const fournisseur = await prisma.fournisseur.create({
      data: {
        id: body.id,
        contact: body.contact || null,
        adresse: body.adresse || null,
        ville: body.ville || null,
        codePostal: body.codePostal || null,
        pays: body.pays || 'France',
        email: body.email || null,
        telephone: body.telephone || null,
        siteWeb: body.siteWeb || null,
        siret: body.siret || null,
        tvaIntra: body.tvaIntra || null,
        type: body.type || 'mixte',
        conditionsPaiement: body.conditionsPaiement ? parseInt(body.conditionsPaiement) : 30,
        notes: body.notes || null,
        actif: body.actif !== false,
      },
    })

    return NextResponse.json({ data: fournisseur }, { status: 201 })
  } catch (error) {
    console.error('POST /api/comptabilite/fournisseurs error:', error)
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

    const existing = await prisma.fournisseur.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Fournisseur non trouvé' }, { status: 404 })
    }

    const fournisseur = await prisma.fournisseur.update({
      where: { id },
      data: {
        ...(updateData.contact !== undefined && { contact: updateData.contact }),
        ...(updateData.adresse !== undefined && { adresse: updateData.adresse }),
        ...(updateData.ville !== undefined && { ville: updateData.ville }),
        ...(updateData.codePostal !== undefined && { codePostal: updateData.codePostal }),
        ...(updateData.pays !== undefined && { pays: updateData.pays }),
        ...(updateData.email !== undefined && { email: updateData.email }),
        ...(updateData.telephone !== undefined && { telephone: updateData.telephone }),
        ...(updateData.siteWeb !== undefined && { siteWeb: updateData.siteWeb }),
        ...(updateData.siret !== undefined && { siret: updateData.siret }),
        ...(updateData.tvaIntra !== undefined && { tvaIntra: updateData.tvaIntra }),
        ...(updateData.type !== undefined && { type: updateData.type }),
        ...(updateData.conditionsPaiement !== undefined && { conditionsPaiement: parseInt(updateData.conditionsPaiement) }),
        ...(updateData.notes !== undefined && { notes: updateData.notes }),
        ...(updateData.actif !== undefined && { actif: updateData.actif }),
      },
    })

    return NextResponse.json({ data: fournisseur })
  } catch (error) {
    console.error('PATCH /api/comptabilite/fournisseurs error:', error)
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

    const existing = await prisma.fournisseur.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Fournisseur non trouvé' }, { status: 404 })
    }

    // Soft delete
    await prisma.fournisseur.update({
      where: { id },
      data: { actif: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comptabilite/fournisseurs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
