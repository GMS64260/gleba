/**
 * API Factures
 * GET/POST/PATCH/DELETE /api/comptabilite/factures
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { creerFacture } from '@/lib/facture-utils'
import { invalidateKpi } from '@/lib/kpi'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
    const statut = searchParams.get('statut')
    const type = searchParams.get('type')
    const clientId = searchParams.get('clientId')

    const userId = session.user.id
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59)

    const where: any = {
      userId,
      date: { gte: startOfYear, lte: endOfYear },
    }
    if (statut) where.statut = statut
    if (type) where.type = type
    if (clientId) where.clientId = parseInt(clientId)

    const factures = await prisma.facture.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        client: { select: { id: true, nom: true } },
        lignes: true,
      },
    })

    // Stats
    const stats = {
      total: factures.length,
      totalHT: factures.reduce((sum, f) => sum + f.totalHT, 0),
      totalTTC: factures.reduce((sum, f) => sum + f.totalTTC, 0),
      parStatut: {
        brouillon: factures.filter(f => f.statut === 'brouillon').length,
        emise: factures.filter(f => f.statut === 'emise').length,
        payee: factures.filter(f => f.statut === 'payee').length,
        annulee: factures.filter(f => f.statut === 'annulee').length,
      },
    }

    return NextResponse.json({ data: factures, stats })
  } catch (error) {
    console.error('GET /api/comptabilite/factures error:', error)
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

    // Transaction atomique : numéro facture + création (évite les doublons)
    const facture = await prisma.$transaction(async (tx) => {
      return creerFacture(tx, {
        userId,
        type: body.type || 'facture',
        clientId: body.clientId ? parseInt(body.clientId) : null,
        clientNom: body.clientNom,
        clientAdresse: body.clientAdresse,
        date: body.date ? new Date(body.date) : new Date(),
        dateEcheance: body.dateEcheance ? new Date(body.dateEcheance) : null,
        objet: body.objet || '',
        totalHT: parseFloat(body.totalHT) || 0,
        totalTVA: parseFloat(body.totalTVA) || 0,
        totalTTC: parseFloat(body.totalTTC) || 0,
        statut: body.statut || 'emise',
        modePaiement: body.modePaiement || null,
        factureOrigineId: body.factureOrigineId ? parseInt(body.factureOrigineId) : null,
        notes: body.notes || null,
        mentionsLegales: body.mentionsLegales || null,
        lignes: (body.lignes || []).map((l: any) => ({
          description: l.description,
          quantite: parseFloat(l.quantite) || 1,
          unite: l.unite || 'unité',
          prixUnitaire: parseFloat(l.prixUnitaire) || 0,
          tauxTVA: parseFloat(l.tauxTVA) || 5.5,
          montantHT: parseFloat(l.montantHT) || 0,
          montantTVA: parseFloat(l.montantTVA) || 0,
          montantTTC: parseFloat(l.montantTTC) || 0,
        })),
      })
    })

    invalidateKpi(session.user.id)
    return NextResponse.json({ data: facture }, { status: 201 })
  } catch (error) {
    console.error('POST /api/comptabilite/factures error:', error)
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

    const existing = await prisma.facture.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    const data: any = {}
    if (updateData.statut !== undefined) {
      data.statut = updateData.statut
      if (updateData.statut === 'payee') {
        data.datePaiement = new Date()
      }
    }
    if (updateData.modePaiement !== undefined) data.modePaiement = updateData.modePaiement
    if (updateData.notes !== undefined) data.notes = updateData.notes

    const facture = await prisma.facture.update({
      where: { id: parseInt(id) },
      data,
      include: { lignes: true, client: true },
    })

    invalidateKpi(session.user.id)
    return NextResponse.json({ data: facture })
  } catch (error) {
    console.error('PATCH /api/comptabilite/factures error:', error)
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

    const existing = await prisma.facture.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 })
    }

    // PROMPT 14B — obligation légale : pas de suppression définitive d'une
    // facture émise/payée. Brouillon → suppression OK. Émise → annulation
    // (statut). Payée → refus (passer par un avoir).
    if (existing.statut === 'brouillon') {
      await prisma.facture.delete({ where: { id: parseInt(id) } })
      invalidateKpi(session.user.id)
      return NextResponse.json({ success: true, action: 'deleted' })
    }
    if (existing.statut === 'payee') {
      return NextResponse.json(
        {
          error: 'Suppression interdite',
          details:
            "Une facture payée ne peut être supprimée. Émettez un avoir pour la régulariser (obligation art. 242 nonies A CGI).",
        },
        { status: 409 }
      )
    }

    await prisma.facture.update({
      where: { id: parseInt(id) },
      data: { statut: 'annulee' },
    })

    invalidateKpi(session.user.id)
    return NextResponse.json({ success: true, action: 'cancelled' })
  } catch (error) {
    console.error('DELETE /api/comptabilite/factures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'annulation', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
