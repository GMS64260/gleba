/**
 * API Abattages
 * GET /api/elevage/abattages - Liste des abattages
 * POST /api/elevage/abattages - Enregistrer un abattage
 * PATCH /api/elevage/abattages - Modifier un abattage
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const destination = searchParams.get('destination')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = { userId: session.user.id }
    if (destination) where.destination = destination
    if (dateDebut || dateFin) {
      where.date = {}
      if (dateDebut) where.date.gte = new Date(dateDebut)
      if (dateFin) where.date.lte = new Date(dateFin)
    }

    const abattages = await prisma.abattage.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        animal: {
          select: { id: true, nom: true, identifiant: true, race: true },
        },
        lot: {
          select: { id: true, nom: true },
        },
      },
    })

    // Stats
    const stats = await prisma.abattage.aggregate({
      where,
      _sum: { quantite: true, poidsVif: true, poidsCarcasse: true, prixVente: true },
      _count: true,
    })

    return NextResponse.json({
      data: abattages,
      stats: {
        totalAnimaux: stats._sum.quantite || 0,
        poidsVifTotal: stats._sum.poidsVif || 0,
        poidsCarcasseTotal: stats._sum.poidsCarcasse || 0,
        revenusVente: stats._sum.prixVente || 0,
        nbAbattages: stats._count,
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/abattages error:', error)
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
      animalId,
      lotId,
      date,
      quantite,
      poidsVif,
      poidsCarcasse,
      destination,
      prixVente,
      lieu,
      notes,
    } = body

    if (!destination || (!animalId && !lotId)) {
      return NextResponse.json(
        { error: 'Destination et animal ou lot requis' },
        { status: 400 }
      )
    }

    // Transaction pour mettre à jour l'animal/lot
    const abattage = await prisma.$transaction(async (tx) => {
      // Créer l'abattage
      const newAbattage = await tx.abattage.create({
        data: {
          userId: session.user.id,
          animalId: animalId ? parseInt(animalId) : null,
          lotId: lotId ? parseInt(lotId) : null,
          date: date ? new Date(date) : new Date(),
          quantite: quantite ? parseInt(quantite) : 1,
          poidsVif: poidsVif ? parseFloat(poidsVif) : null,
          poidsCarcasse: poidsCarcasse ? parseFloat(poidsCarcasse) : null,
          destination,
          prixVente: prixVente ? parseFloat(prixVente) : null,
          lieu,
          notes,
        },
        include: {
          animal: true,
          lot: true,
        },
      })

      // Mettre à jour le statut de l'animal si individuel
      if (animalId) {
        const animal = await tx.animal.findFirst({
          where: { id: parseInt(animalId), userId: session.user.id },
        })
        if (animal) {
          await tx.animal.update({
            where: { id: animal.id },
            data: {
              statut: 'abattu',
              dateSortie: new Date(date || Date.now()),
              causeSortie: 'Abattage',
            },
          })
        }
      }

      // Mettre à jour la quantité du lot si lot
      if (lotId && quantite) {
        const lot = await tx.lotAnimaux.findFirst({
          where: { id: parseInt(lotId), userId: session.user.id },
        })
        if (lot) {
          const nouvelleQuantite = Math.max(0, lot.quantiteActuelle - parseInt(quantite))
          await tx.lotAnimaux.update({
            where: { id: lot.id },
            data: {
              quantiteActuelle: nouvelleQuantite,
              statut: nouvelleQuantite === 0 ? 'termine' : 'actif',
            },
          })
        }
      }

      return newAbattage
    })

    return NextResponse.json({ data: abattage }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/abattages error:', error)
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
    const { id, date, quantite, poidsVif, poidsCarcasse, destination, prixVente, notes } = body
    const userId = session.user.id

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.abattage.findFirst({
      where: { id: parseInt(id), userId },
      include: {
        animal: { select: { id: true, nom: true, identifiant: true, race: true } },
        lot: { select: { id: true, nom: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Abattage non trouvé' }, { status: 404 })
    }

    const updateData: any = {}
    if (date !== undefined) updateData.date = new Date(date)
    if (quantite !== undefined) updateData.quantite = parseInt(quantite)
    if (poidsVif !== undefined) updateData.poidsVif = poidsVif ? parseFloat(poidsVif) : null
    if (poidsCarcasse !== undefined) updateData.poidsCarcasse = poidsCarcasse ? parseFloat(poidsCarcasse) : null
    if (destination !== undefined) updateData.destination = destination
    if (prixVente !== undefined) updateData.prixVente = prixVente ? parseFloat(prixVente) : null
    if (notes !== undefined) updateData.notes = notes

    // Transaction atomique : facture + update abattage + ajustement lot
    const abattage = await prisma.$transaction(async (tx) => {
      // Créer une facture si demandé et si prixVente existe
      if (body.creerFacture && (updateData.prixVente || existing.prixVente)) {
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

        const prixTotalTTC = updateData.prixVente || existing.prixVente
        const totalHT = prixTotalTTC / 1.055
        const totalTVA = prixTotalTTC - totalHT

        const animalInfo = existing.animal?.nom || existing.lot?.nom || 'Abattage'
        const quantiteAbattue = updateData.quantite !== undefined ? updateData.quantite : existing.quantite

        const facture = await tx.facture.create({
          data: {
            userId,
            numero,
            type: 'abattage',
            clientNom: 'Client vente abattage',
            date: new Date(),
            objet: `Vente abattage - ${animalInfo}`,
            totalHT,
            totalTVA,
            totalTTC: prixTotalTTC,
            statut: 'payee',
            datePaiement: new Date(),
            modePaiement: 'especes',
            lignes: {
              create: [{
                ordre: 0,
                description: animalInfo,
                quantite: quantiteAbattue,
                unite: 'animal',
                prixUnitaire: totalHT / quantiteAbattue,
                tauxTVA: 5.5,
                montantHT: totalHT,
                montantTVA: totalTVA,
                montantTTC: prixTotalTTC,
              }],
            },
          },
        })

        updateData.factureId = facture.id
      }

      // Ajuster les quantités du lot si quantite a changé et il y a un lotId
      if (quantite !== undefined && existing.lotId) {
        const newQuantite = parseInt(quantite)
        const difference = newQuantite - existing.quantite

        if (difference !== 0) {
          const lot = await tx.lotAnimaux.findFirst({
            where: { id: existing.lotId, userId },
          })

          if (lot) {
            // Si quantite augmente, on abat plus d'animaux donc on diminue le lot
            // Si quantite diminue, on abat moins d'animaux donc on augmente le lot
            const nouvelleQuantite = Math.max(0, lot.quantiteActuelle - difference)
            await tx.lotAnimaux.update({
              where: { id: lot.id },
              data: {
                quantiteActuelle: nouvelleQuantite,
                statut: nouvelleQuantite === 0 ? 'termine' : 'actif',
              },
            })
          }
        }
      }

      return tx.abattage.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          animal: { select: { id: true, nom: true, identifiant: true, race: true } },
          lot: { select: { id: true, nom: true } },
        },
      })
    })

    return NextResponse.json({ data: abattage })
  } catch (error) {
    console.error('PATCH /api/elevage/abattages error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
