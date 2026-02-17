/**
 * API Dépenses Manuelles
 * GET/POST/PATCH/DELETE /api/comptabilite/depenses-manuelles
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

    const [depenses, stats] = await Promise.all([
      prisma.depenseManuelle.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
      }),
      prisma.depenseManuelle.aggregate({
        where,
        _sum: { montant: true },
        _count: true,
      }),
    ])

    return NextResponse.json({
      data: depenses,
      stats: {
        total: stats._sum.montant || 0,
        count: stats._count,
      },
    })
  } catch (error) {
    console.error('GET /api/comptabilite/depenses-manuelles error:', error)
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

    // Calcul TVA
    const montantTTC = parseFloat(body.montant)
    const tauxTVA = parseFloat(body.tauxTVA) || 20
    const montantHT = body.montantHT ? parseFloat(body.montantHT) : montantTTC / (1 + tauxTVA / 100)
    const montantTVA = body.montantTVA ? parseFloat(body.montantTVA) : montantTTC - montantHT

    const depense = await prisma.depenseManuelle.create({
      data: {
        userId,
        date: body.date ? new Date(body.date) : new Date(),
        categorie: body.categorie,
        description: body.description,
        tauxTVA,
        montantHT,
        montantTVA,
        montant: montantTTC,
        module: body.module || null,
        fournisseurId: body.fournisseurId || null,
        fournisseurNom: body.fournisseurNom || body.fournisseur || null,
        refFacture: body.refFacture || body.facture || null,
        paye: body.paye !== false,
        dateEcheance: body.dateEcheance ? new Date(body.dateEcheance) : null,
        notes: body.notes || null,
      },
    })

    return NextResponse.json(depense, { status: 201 })
  } catch (error) {
    console.error('POST /api/comptabilite/depenses-manuelles error:', error)
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

    if (!body.id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const depense = await prisma.depenseManuelle.update({
      where: { id: body.id, userId: session.user.id },
      data: {
        ...(body.paye !== undefined && { paye: body.paye }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.categorie && { categorie: body.categorie }),
        ...(body.description && { description: body.description }),
        ...(body.montant && { montant: parseFloat(body.montant) }),
        ...(body.tauxTVA !== undefined && { tauxTVA: parseFloat(body.tauxTVA) }),
        ...(body.montantHT !== undefined && { montantHT: parseFloat(body.montantHT) }),
        ...(body.montantTVA !== undefined && { montantTVA: parseFloat(body.montantTVA) }),
        ...(body.fournisseurNom !== undefined && { fournisseurNom: body.fournisseurNom }),
        ...(body.fournisseur !== undefined && { fournisseurNom: body.fournisseur }),
        ...(body.fournisseurId !== undefined && { fournisseurId: body.fournisseurId }),
        ...(body.refFacture !== undefined && { refFacture: body.refFacture }),
        ...(body.facture !== undefined && { refFacture: body.facture }),
        ...(body.dateEcheance !== undefined && { dateEcheance: body.dateEcheance ? new Date(body.dateEcheance) : null }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    })

    return NextResponse.json(depense)
  } catch (error) {
    console.error('PATCH /api/comptabilite/depenses-manuelles error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
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

    await prisma.depenseManuelle.delete({
      where: { id: parseInt(id), userId: session.user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comptabilite/depenses-manuelles error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
