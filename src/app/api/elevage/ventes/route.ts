/**
 * API Ventes de produits
 * GET /api/elevage/ventes - Liste des ventes
 * POST /api/elevage/ventes - Enregistrer une vente
 * PATCH /api/elevage/ventes - Modifier une vente (ex: marquer payé)
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
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = { userId: session.user.id }
    if (type) where.type = type
    if (dateDebut || dateFin) {
      where.date = {}
      if (dateDebut) where.date.gte = new Date(dateDebut)
      if (dateFin) where.date.lte = new Date(dateFin)
    }
    // Filtre par statut de paiement
    const payeParam = searchParams.get('paye')
    if (payeParam !== null) {
      where.paye = payeParam === 'true'
    }

    const ventes = await prisma.venteProduit.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        destination: true,
      },
    })

    // Stats agrégées
    const stats = await prisma.venteProduit.aggregate({
      where,
      _sum: { prixTotal: true },
      _count: true,
    })

    // Stats par type
    const statsParType = await prisma.venteProduit.groupBy({
      by: ['type'],
      where,
      _sum: { prixTotal: true, quantite: true },
      _count: true,
    })

    return NextResponse.json({
      data: ventes,
      stats: {
        totalVentes: stats._sum.prixTotal || 0,
        nbVentes: stats._count,
        parType: statsParType.map(s => ({
          type: s.type,
          total: s._sum.prixTotal || 0,
          quantite: s._sum.quantite || 0,
          count: s._count,
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/ventes error:', error)
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
    const {
      date,
      type,
      description,
      quantite,
      unite,
      prixUnitaire,
      client,
      destinationId,
      paye,
      notes,
    } = body

    if (!type || !quantite || !prixUnitaire || !unite) {
      return NextResponse.json(
        { error: 'Type, quantité, unité et prix unitaire requis' },
        { status: 400 }
      )
    }

    const prixTotal = parseFloat(quantite) * parseFloat(prixUnitaire)

    const result = await prisma.$transaction(async (tx) => {
      const vente = await tx.venteProduit.create({
        data: {
          userId: session.user.id,
          date: date ? new Date(date) : new Date(),
          type,
          description,
          quantite: parseFloat(quantite),
          unite,
          prixUnitaire: parseFloat(prixUnitaire),
          prixTotal,
          client,
          destinationId,
          paye: paye !== false,
          notes,
        },
        include: {
          destination: true,
        },
      })

      // Si vente d'animal vivant, mettre à jour le statut de l'animal
      if (type === 'animal_vivant' && body.animalId) {
        const animal = await tx.animal.findFirst({
          where: { id: parseInt(body.animalId), userId: session.user.id },
        })
        if (animal) {
          await tx.animal.update({
            where: { id: animal.id },
            data: {
              statut: 'vendu',
              dateSortie: date ? new Date(date) : new Date(),
              causeSortie: 'Vente',
            },
          })
        }
      }

      return vente
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/ventes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
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

    const existing = await prisma.venteProduit.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vente non trouvée' }, { status: 404 })
    }

    await prisma.venteProduit.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/ventes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const { id, paye, client, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.venteProduit.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Vente non trouvée' }, { status: 404 })
    }

    const updateData: any = {}
    if (paye !== undefined) updateData.paye = paye
    if (client !== undefined) updateData.client = client
    if (notes !== undefined) updateData.notes = notes

    const userId = session.user.id

    // Transaction atomique : facture + update vente
    const vente = await prisma.$transaction(async (tx) => {
      if (body.creerFacture && existing.prixTotal) {
        const year = new Date().getFullYear()
        const lastFacture = await tx.facture.findFirst({
          where: {
            userId,
            numero: { startsWith: `F-${year}-` },
          },
          orderBy: { numero: 'desc' },
        })

        let nextNum = 1
        if (lastFacture) {
          const parts = lastFacture.numero.split('-')
          nextNum = parseInt(parts[2]) + 1
        }
        const numero = `F-${year}-${String(nextNum).padStart(4, '0')}`

        let clientNom = existing.client || 'Client anonyme'
        let clientAdresse = null

        if (body.clientId) {
          const clientData = await tx.client.findFirst({
            where: { id: body.clientId, userId },
          })
          if (clientData) {
            clientNom = clientData.nom
            clientAdresse = [clientData.adresse, clientData.codePostal, clientData.ville].filter(Boolean).join(', ')
          }
        }

        const totalHT = existing.prixTotal / 1.055
        const totalTVA = existing.prixTotal - totalHT

        const facture = await tx.facture.create({
          data: {
            userId,
            numero,
            type: 'vente_elevage',
            clientId: body.clientId || null,
            clientNom,
            clientAdresse,
            date: new Date(),
            objet: `Vente de ${existing.type} - ${existing.description || ''}`,
            totalHT,
            totalTVA,
            totalTTC: existing.prixTotal,
            statut: 'payee',
            datePaiement: new Date(),
            modePaiement: 'especes',
            lignes: {
              create: [{
                ordre: 0,
                description: `${existing.type} - ${existing.description || ''}`,
                quantite: existing.quantite,
                unite: existing.unite,
                prixUnitaire: existing.prixUnitaire / 1.055,
                tauxTVA: 5.5,
                montantHT: totalHT,
                montantTVA: totalTVA,
                montantTTC: existing.prixTotal,
              }],
            },
          },
        })

        updateData.factureId = facture.id
      }

      return tx.venteProduit.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          destination: true,
        },
      })
    })

    return NextResponse.json({ data: vente })
  } catch (error) {
    console.error('PATCH /api/elevage/ventes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
