/**
 * API Récolte Arbre individuelle (avec gestion stock/vente)
 * GET - Détail d'une récolte
 * PUT - Mise à jour complète
 * PATCH - Transition de statut (vente, perte, etc.)
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/recoltes/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const recolte = await prisma.recolteArbre.findUnique({
      where: {
        id: recolteId,
        userId: session!.user.id,
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
            espece: true,
          },
        },
      },
    })

    if (!recolte) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    return NextResponse.json(recolte)
  } catch (err) {
    console.error("GET /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la récolte" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/recoltes/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.recolteArbre.findUnique({
      where: { id: recolteId, userId: session!.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    const recolte = await prisma.recolteArbre.update({
      where: { id: recolteId },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        quantite: body.quantite,
        qualite: body.qualite,
        prixKg: body.prixKg,
        datePeremption: body.datePeremption !== undefined
          ? (body.datePeremption ? new Date(body.datePeremption) : null)
          : undefined,
        notes: body.notes,
      },
      include: {
        arbre: {
          select: { id: true, nom: true, type: true },
        },
      },
    })

    return NextResponse.json(recolte)
  } catch (err) {
    console.error("PUT /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// PATCH /api/arbres/recoltes/[id] - Transition de statut
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const userId = session!.user.id

    const existing = await prisma.recolteArbre.findUnique({
      where: { id: recolteId, userId },
      include: {
        arbre: {
          select: { id: true, nom: true, espece: true, variete: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    // Préparer les données de mise à jour
    const updateData: any = {}
    if (body.statut !== undefined) updateData.statut = body.statut
    if (body.dateVente !== undefined) updateData.dateVente = body.dateVente ? new Date(body.dateVente) : null
    if (body.prixKg !== undefined) updateData.prixKg = body.prixKg
    if (body.prixTotal !== undefined) updateData.prixTotal = body.prixTotal
    if (body.clientId !== undefined) updateData.clientId = body.clientId
    if (body.clientNom !== undefined) updateData.clientNom = body.clientNom
    if (body.datePeremption !== undefined) updateData.datePeremption = body.datePeremption ? new Date(body.datePeremption) : null
    if (body.notes !== undefined) updateData.notes = body.notes

    // Transaction atomique : facture + update récolte arbre
    const recolte = await prisma.$transaction(async (tx) => {
      if (body.statut === "vendu" && body.creerFacture && body.prixTotal) {
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

        let clientNom = body.clientNom || 'Client anonyme'
        let clientAdresse = null

        if (body.clientId) {
          const client = await tx.client.findFirst({
            where: { id: body.clientId, userId },
          })
          if (client) {
            clientNom = client.nom
            clientAdresse = [client.adresse, client.codePostal, client.ville].filter(Boolean).join(', ')
          }
        }

        const totalHT = body.prixTotal / 1.055
        const totalTVA = body.prixTotal - totalHT

        const arbreNom = existing.arbre?.nom || 'Fruits'
        const especeNom = existing.arbre?.espece || ''

        const facture = await tx.facture.create({
          data: {
            userId,
            numero,
            type: 'facture',
            clientId: body.clientId || null,
            clientNom,
            clientAdresse,
            date: new Date(),
            objet: `Vente de ${arbreNom}${especeNom ? ` (${especeNom})` : ''}`,
            totalHT,
            totalTVA,
            totalTTC: body.prixTotal,
            statut: 'payee',
            datePaiement: new Date(),
            modePaiement: 'especes',
            lignes: {
              create: [{
                ordre: 0,
                description: `${arbreNom}${especeNom ? ` - ${especeNom}` : ''}`,
                quantite: existing.quantite,
                unite: 'kg',
                prixUnitaire: (body.prixKg || 0) / 1.055,
                tauxTVA: 5.5,
                montantHT: totalHT,
                montantTVA: totalTVA,
                montantTTC: body.prixTotal,
              }],
            },
          },
        })

        updateData.factureId = facture.id
      }

      if (body.statut === "vendu") {
        updateData.dateVente = updateData.dateVente || new Date()
      }

      return tx.recolteArbre.update({
        where: { id: recolteId },
        data: updateData,
        include: {
          arbre: {
            select: { id: true, nom: true, type: true, espece: true },
          },
        },
      })
    })

    return NextResponse.json(recolte)
  } catch (err) {
    console.error("PATCH /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/recoltes/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id, 10)
    if (isNaN(recolteId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.recolteArbre.findUnique({
      where: { id: recolteId, userId: session!.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Récolte non trouvée" }, { status: 404 })
    }

    await prisma.recolteArbre.delete({
      where: { id: recolteId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/recoltes/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
