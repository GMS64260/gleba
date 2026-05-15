/**
 * API Dépenses Manuelles
 * GET/POST/PATCH/DELETE /api/comptabilite/depenses-manuelles
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createDepenseManuelleSchema, updateDepenseManuelleSchema } from '@/lib/validations/depense-manuelle'
import { invalidateKpi } from '@/lib/kpi'
import { ensureFournisseurForUser } from '@/lib/comptabilite/ensure-fournisseur'

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
    const parsed = createDepenseManuelleSchema.safeParse(body)
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

    // QA 2026-05-15 — Bug #11 : auto-création du fournisseur si seul
    // un `fournisseurNom` est fourni (saisie rapide). Le find-or-create
    // est idempotent, donc pas de doublon si le fournisseur existait.
    const depense = await prisma.$transaction(async (tx) => {
      let resolvedFournisseurId: string | null = rest.fournisseurId ?? null
      if (!resolvedFournisseurId && rest.fournisseurNom) {
        resolvedFournisseurId = await ensureFournisseurForUser(
          userId,
          { nom: rest.fournisseurNom },
          tx
        )
      }
      return tx.depenseManuelle.create({
        data: {
          userId,
          date: rest.date ?? new Date(),
          categorie: rest.categorie,
          description: rest.description,
          tauxTVA,
          montantHT,
          montantTVA,
          montant,
          module: rest.module ?? null,
          fournisseurId: resolvedFournisseurId,
          fournisseurNom: rest.fournisseurNom ?? null,
          refFacture: rest.refFacture ?? null,
          paye: rest.paye,
          dateEcheance: rest.dateEcheance ?? null,
          notes: rest.notes ?? null,
          journal: rest.journal ?? 'AC',
          modeReglement: rest.modeReglement ?? null,
          numeroPiece: rest.numeroPiece ?? null,
          pjUrl: rest.pjUrl || null,
          tvaInferee: false,
        },
      })
    })

    invalidateKpi(userId)
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
    const parsed = updateDepenseManuelleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { id, ...updates } = parsed.data

    const existing = await prisma.depenseManuelle.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Dépense non trouvée' }, { status: 404 })
    }

    const updateData: any = {}
    if (updates.paye !== undefined) updateData.paye = updates.paye
    if (updates.date !== undefined) updateData.date = updates.date
    if (updates.categorie !== undefined) updateData.categorie = updates.categorie
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.montant !== undefined) updateData.montant = updates.montant
    if (updates.tauxTVA !== undefined) {
      updateData.tauxTVA = updates.tauxTVA
      updateData.tvaInferee = false
    }
    if (updates.montantHT !== undefined) updateData.montantHT = updates.montantHT
    if (updates.montantTVA !== undefined) updateData.montantTVA = updates.montantTVA
    if (updates.fournisseurNom !== undefined) updateData.fournisseurNom = updates.fournisseurNom
    if (updates.fournisseurId !== undefined) updateData.fournisseurId = updates.fournisseurId
    if (updates.refFacture !== undefined) updateData.refFacture = updates.refFacture
    if (updates.dateEcheance !== undefined) updateData.dateEcheance = updates.dateEcheance ?? null
    if (updates.notes !== undefined) updateData.notes = updates.notes
    if (updates.journal !== undefined) updateData.journal = updates.journal
    if (updates.modeReglement !== undefined) updateData.modeReglement = updates.modeReglement
    if (updates.numeroPiece !== undefined) updateData.numeroPiece = updates.numeroPiece
    if (updates.pjUrl !== undefined) updateData.pjUrl = updates.pjUrl || null

    const depense = await prisma.depenseManuelle.update({
      where: { id },
      data: updateData,
    })

    invalidateKpi(session.user.id)
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

    const existing = await prisma.depenseManuelle.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Dépense non trouvée' }, { status: 404 })
    }

    if (existing.auto) {
      return NextResponse.json(
        { error: 'Cette dépense est générée automatiquement. Modifiez ou supprimez la source (intervention) pour la supprimer.' },
        { status: 400 }
      )
    }

    await prisma.depenseManuelle.delete({
      where: { id: parseInt(id), userId: session.user.id },
    })

    invalidateKpi(session.user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comptabilite/depenses-manuelles error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
