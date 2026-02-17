/**
 * API Ventes Manuelles
 * GET/POST/PATCH/DELETE /api/comptabilite/ventes-manuelles
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const categorie = searchParams.get('categorie')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const paye = searchParams.get('paye')
    const limit = parseInt(searchParams.get('limit') || '100')

    const userId = session.user.id

    const where: any = { userId }

    if (categorie) where.categorie = categorie
    if (paye !== null && paye !== '') where.paye = paye === 'true'
    if (dateDebut || dateFin) {
      where.date = {}
      if (dateDebut) where.date.gte = new Date(dateDebut)
      if (dateFin) where.date.lte = new Date(dateFin)
    }

    const [ventes, stats] = await Promise.all([
      prisma.venteManuelle.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
      }),
      prisma.venteManuelle.aggregate({
        where,
        _sum: { montant: true },
        _count: true,
      }),
    ])

    return NextResponse.json({
      data: ventes,
      stats: {
        total: stats._sum.montant || 0,
        count: stats._count,
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/ventes-manuelles error:', error)
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

    // Calcul TVA avec validation
    const montantTTC = parseFloat(body.montant)
    if (isNaN(montantTTC) || montantTTC < 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }
    const tauxTVA = parseFloat(body.tauxTVA) || 5.5
    if (tauxTVA < 0 || tauxTVA > 100) {
      return NextResponse.json({ error: 'Taux de TVA invalide (0-100)' }, { status: 400 })
    }
    const montantHT = body.montantHT ? parseFloat(body.montantHT) : montantTTC / (1 + tauxTVA / 100)
    const montantTVA = body.montantTVA ? parseFloat(body.montantTVA) : montantTTC - montantHT

    const vente = await prisma.venteManuelle.create({
      data: {
        userId,
        date: body.date ? new Date(body.date) : new Date(),
        categorie: body.categorie,
        description: body.description,
        quantite: body.quantite ? parseFloat(body.quantite) : null,
        unite: body.unite || null,
        prixUnitaire: body.prixUnitaire ? parseFloat(body.prixUnitaire) : null,
        tauxTVA,
        montantHT,
        montantTVA,
        montant: montantTTC,
        clientId: body.clientId ? parseInt(body.clientId) : null,
        clientNom: body.clientNom || body.client || null,
        module: body.module || null,
        paye: body.paye !== false,
        notes: body.notes || null,
      },
    })

    return NextResponse.json(vente, { status: 201 })
  } catch (error) {
    console.error('POST /api/comptabilite/ventes-manuelles error:', error)
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
    const { id, paye, client, clientNom, clientId, notes, description, montant, tauxTVA, montantHT, montantTVA } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.venteManuelle.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vente non trouvée' }, { status: 404 })
    }

    const updateData: any = {}
    if (paye !== undefined) updateData.paye = paye
    if (clientNom !== undefined) updateData.clientNom = clientNom
    if (client !== undefined) updateData.clientNom = client // backwards compatibility
    if (clientId !== undefined) updateData.clientId = clientId ? parseInt(clientId) : null
    if (notes !== undefined) updateData.notes = notes
    if (description !== undefined) updateData.description = description
    if (montant !== undefined) {
      const parsedMontant = parseFloat(montant)
      if (isNaN(parsedMontant) || parsedMontant < 0) {
        return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
      }
      updateData.montant = parsedMontant
    }
    if (tauxTVA !== undefined) {
      const parsedTVA = parseFloat(tauxTVA)
      if (isNaN(parsedTVA) || parsedTVA < 0 || parsedTVA > 100) {
        return NextResponse.json({ error: 'Taux de TVA invalide (0-100)' }, { status: 400 })
      }
      updateData.tauxTVA = parsedTVA
    }
    if (montantHT !== undefined) updateData.montantHT = parseFloat(montantHT)
    if (montantTVA !== undefined) updateData.montantTVA = parseFloat(montantTVA)

    const vente = await prisma.venteManuelle.update({
      where: { id: parseInt(id) },
      data: updateData,
    })

    return NextResponse.json({ data: vente })
  } catch (error) {
    console.error('PATCH /api/comptabilite/ventes-manuelles error:', error)
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

    await prisma.venteManuelle.delete({
      where: { id: parseInt(id), userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comptabilite/ventes-manuelles error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
