/**
 * API Factures
 * GET/POST/PATCH/DELETE /api/comptabilite/factures
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

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
      const year = new Date().getFullYear()
      const prefix = body.type === 'avoir' ? 'AV' : 'F'

      const lastFacture = await tx.facture.findFirst({
        where: {
          userId,
          numero: { startsWith: `${prefix}-${year}-` },
        },
        orderBy: { numero: 'desc' },
      })

      let nextNum = 1
      if (lastFacture) {
        const parts = lastFacture.numero.split('-')
        nextNum = parseInt(parts[2]) + 1
      }
      const numero = `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`

      let clientNom = body.clientNom || 'Client anonyme'
      let clientAdresse = body.clientAdresse || null

      if (body.clientId) {
        const client = await tx.client.findFirst({
          where: { id: parseInt(body.clientId), userId },
        })
        if (client) {
          clientNom = client.nom
          clientAdresse = [client.adresse, client.codePostal, client.ville].filter(Boolean).join(', ')
        }
      }

      return tx.facture.create({
        data: {
          userId,
          numero,
          type: body.type || 'facture',
          clientId: body.clientId ? parseInt(body.clientId) : null,
          clientNom,
          clientAdresse,
          date: body.date ? new Date(body.date) : new Date(),
          dateEcheance: body.dateEcheance ? new Date(body.dateEcheance) : null,
          objet: body.objet || null,
          totalHT: parseFloat(body.totalHT) || 0,
          totalTVA: parseFloat(body.totalTVA) || 0,
          totalTTC: parseFloat(body.totalTTC) || 0,
          statut: body.statut || 'emise',
          modePaiement: body.modePaiement || null,
          factureOrigineId: body.factureOrigineId ? parseInt(body.factureOrigineId) : null,
          notes: body.notes || null,
          mentionsLegales: body.mentionsLegales || null,
          lignes: body.lignes ? {
            create: body.lignes.map((l: any, index: number) => ({
              ordre: index,
              description: l.description,
              quantite: parseFloat(l.quantite) || 1,
              unite: l.unite || 'unité',
              prixUnitaire: parseFloat(l.prixUnitaire) || 0,
              tauxTVA: parseFloat(l.tauxTVA) || 5.5,
              montantHT: parseFloat(l.montantHT) || 0,
              montantTVA: parseFloat(l.montantTVA) || 0,
              montantTTC: parseFloat(l.montantTTC) || 0,
            })),
          } : undefined,
        },
        include: {
          lignes: true,
          client: true,
        },
      })
    })

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

    // On annule plutôt que supprimer (obligation légale)
    await prisma.facture.update({
      where: { id: parseInt(id) },
      data: { statut: 'annulee' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/comptabilite/factures error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'annulation', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
