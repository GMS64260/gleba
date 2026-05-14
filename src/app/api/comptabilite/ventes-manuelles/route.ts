/**
 * API Ventes Manuelles
 * GET/POST/PATCH/DELETE /api/comptabilite/ventes-manuelles
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createVenteManuelleSchema, updateVenteManuelleSchema } from '@/lib/validations/vente-manuelle'
import { invalidateKpi } from '@/lib/kpi'

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
    const parsed = createVenteManuelleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const userId = session.user.id
    const { montant, tauxTVA, ...rest } = parsed.data

    const montantHT = rest.montantHT ?? montant / (1 + tauxTVA / 100)
    const montantTVA = rest.montantTVA ?? montant - montantHT

    const vente = await prisma.venteManuelle.create({
      data: {
        userId,
        date: rest.date ?? new Date(),
        categorie: rest.categorie,
        description: rest.description,
        quantite: rest.quantite ?? null,
        unite: rest.unite ?? null,
        prixUnitaire: rest.prixUnitaire ?? null,
        tauxTVA,
        montantHT,
        montantTVA,
        montant,
        clientId: rest.clientId ?? null,
        clientNom: rest.clientNom ?? null,
        module: rest.module ?? null,
        paye: rest.paye,
        notes: rest.notes ?? null,
        journal: rest.journal ?? 'VE',
        modeReglement: rest.modeReglement ?? null,
        numeroPiece: rest.numeroPiece ?? null,
        pjUrl: rest.pjUrl || null,
        tvaInferee: false,
      },
    })

    invalidateKpi(userId)
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
    const parsed = updateVenteManuelleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { id, ...updates } = parsed.data

    const existing = await prisma.venteManuelle.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vente non trouvée' }, { status: 404 })
    }

    const updateData: any = {}
    if (updates.paye !== undefined) updateData.paye = updates.paye
    if (updates.clientNom !== undefined) updateData.clientNom = updates.clientNom
    if (updates.clientId !== undefined) updateData.clientId = updates.clientId ?? null
    if (updates.notes !== undefined) updateData.notes = updates.notes
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.montant !== undefined) updateData.montant = updates.montant
    if (updates.tauxTVA !== undefined) {
      updateData.tauxTVA = updates.tauxTVA
      // Si on modifie le taux manuellement, on ne considère plus la TVA comme inférée.
      updateData.tvaInferee = false
    }
    if (updates.montantHT !== undefined) updateData.montantHT = updates.montantHT
    if (updates.montantTVA !== undefined) updateData.montantTVA = updates.montantTVA
    if (updates.journal !== undefined) updateData.journal = updates.journal
    if (updates.modeReglement !== undefined) updateData.modeReglement = updates.modeReglement
    if (updates.numeroPiece !== undefined) updateData.numeroPiece = updates.numeroPiece
    if (updates.pjUrl !== undefined) updateData.pjUrl = updates.pjUrl || null

    const vente = await prisma.venteManuelle.update({
      where: { id },
      data: updateData,
    })

    invalidateKpi(session.user.id)
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

    const existing = await prisma.venteManuelle.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vente non trouvée' }, { status: 404 })
    }

    if (existing.auto) {
      return NextResponse.json(
        { error: 'Cette vente est générée automatiquement. Modifiez ou supprimez la source (récolte, vente produit, abattage) pour la supprimer.' },
        { status: 400 }
      )
    }

    await prisma.venteManuelle.delete({
      where: { id: parseInt(id), userId: session.user.id },
    })

    invalidateKpi(session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comptabilite/ventes-manuelles error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
