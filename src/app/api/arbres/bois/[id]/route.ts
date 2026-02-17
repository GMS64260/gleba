/**
 * API Production Bois individuelle
 * GET - Détail d'une production
 * PUT - Mise à jour
 * DELETE - Suppression
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/arbres/bois/[id]
export async function GET(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const productionId = parseInt(id, 10)
    if (isNaN(productionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const production = await prisma.productionBois.findUnique({
      where: {
        id: productionId,
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

    if (!production) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    return NextResponse.json(production)
  } catch (err) {
    console.error("GET /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la production" },
      { status: 500 }
    )
  }
}

// PUT /api/arbres/bois/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const productionId = parseInt(id, 10)
    if (isNaN(productionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Vérifier propriété
    const existing = await prisma.productionBois.findUnique({
      where: {
        id: productionId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    const body = await request.json()

    const production = await prisma.productionBois.update({
      where: { id: productionId },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        type: body.type,
        volumeM3: body.volumeM3,
        poidsKg: body.poidsKg,
        destination: body.destination,
        prixVente: body.prixVente,
        notes: body.notes,
      },
      include: {
        arbre: {
          select: {
            id: true,
            nom: true,
            type: true,
          },
        },
      },
    })

    return NextResponse.json(production)
  } catch (err) {
    console.error("PUT /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// PATCH /api/arbres/bois/[id] - Mise à jour partielle (vente, utilisation, perte)
export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const productionId = parseInt(id, 10)
    if (isNaN(productionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    const existing = await prisma.productionBois.findUnique({
      where: {
        id: productionId,
        userId: session!.user.id,
      },
      include: { arbre: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    const body = await request.json()
    const userId = session!.user.id

    // Préparer les données de mise à jour
    const updateData: any = {}
    if (body.statut !== undefined) {
      // Valider le statut
      const validStatuts = ["en_stock", "vendu", "utilise", "perte"]
      if (!validStatuts.includes(body.statut)) {
        return NextResponse.json(
          { error: `Statut invalide. Valeurs acceptées: ${validStatuts.join(", ")}` },
          { status: 400 }
        )
      }
      updateData.statut = body.statut
    }
    if (body.destination !== undefined) updateData.destination = body.destination
    if (body.dateVente !== undefined) updateData.dateVente = body.dateVente ? new Date(body.dateVente) : null
    if (body.prixVente !== undefined) updateData.prixVente = body.prixVente
    if (body.clientId !== undefined) updateData.clientId = body.clientId
    if (body.clientNom !== undefined) updateData.clientNom = body.clientNom
    if (body.notes !== undefined) updateData.notes = body.notes

    // Transaction atomique : facture + update production bois
    const production = await prisma.$transaction(async (tx) => {
      if (body.statut === "vendu" && body.creerFacture && body.prixVente) {
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

        const totalHT = body.prixVente / 1.055
        const totalTVA = body.prixVente - totalHT

        const typeDescription = existing.type || 'Bois'
        const arbreInfo = existing.arbre ? ` - ${existing.arbre.nom}` : ''
        const volumeInfo = existing.volumeM3 ? ` (${existing.volumeM3} m³)` : ''

        const facture = await tx.facture.create({
          data: {
            userId,
            numero,
            type: 'vente_bois',
            clientId: body.clientId || null,
            clientNom,
            clientAdresse,
            date: new Date(),
            objet: `Vente de bois - ${typeDescription}${volumeInfo}`,
            totalHT,
            totalTVA,
            totalTTC: body.prixVente,
            statut: 'payee',
            datePaiement: new Date(),
            modePaiement: 'especes',
            lignes: {
              create: [{
                ordre: 0,
                description: `${typeDescription}${arbreInfo}`,
                quantite: existing.volumeM3 || 1,
                unite: existing.volumeM3 ? 'm³' : 'lot',
                prixUnitaire: totalHT / (existing.volumeM3 || 1),
                tauxTVA: 5.5,
                montantHT: totalHT,
                montantTVA: totalTVA,
                montantTTC: body.prixVente,
              }],
            },
          },
        })

        updateData.factureId = facture.id
      }

      return tx.productionBois.update({
        where: { id: productionId },
        data: updateData,
        include: {
          arbre: {
            select: {
              id: true,
              nom: true,
              type: true,
              espece: true,
            },
          },
          facture: {
            select: {
              id: true,
              numero: true,
              type: true,
              clientNom: true,
              totalTTC: true,
              statut: true,
            },
          },
        },
      })
    })

    return NextResponse.json(production)
  } catch (err) {
    console.error("PATCH /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour" },
      { status: 500 }
    )
  }
}

// DELETE /api/arbres/bois/[id]
export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const productionId = parseInt(id, 10)
    if (isNaN(productionId)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 })
    }

    // Vérifier propriété
    const existing = await prisma.productionBois.findUnique({
      where: {
        id: productionId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Production non trouvée" }, { status: 404 })
    }

    await prisma.productionBois.delete({
      where: { id: productionId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/arbres/bois/[id] error:", err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    )
  }
}
