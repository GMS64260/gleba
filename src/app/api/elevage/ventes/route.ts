/**
 * API Ventes de produits
 * GET /api/elevage/ventes - Liste des ventes
 * POST /api/elevage/ventes - Enregistrer une vente
 * PATCH /api/elevage/ventes - Modifier une vente (ex: marquer payé)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createVenteFromVenteProduit, deleteAutoEntry } from '@/lib/auto-compta'
import { creerFacture } from '@/lib/facture-utils'
import { venteProduitSchema } from '@/lib/validations/elevage-vente'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const limit = parseInt(searchParams.get('limit') || '100')
    const annee = parseInt(searchParams.get('annee') || String(new Date().getFullYear()))
    const yearStart = new Date(annee, 0, 1)
    const yearEnd = new Date(annee, 11, 31, 23, 59, 59)

    const where: any = { userId: session.user.id, annule: { not: true }, date: { gte: yearStart, lte: yearEnd } }
    if (type) where.type = type
    if (dateDebut || dateFin) {
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
      meta: { year: annee, total: ventes.length },
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
    const parsed = venteProduitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { date, type, description, quantite, unite, prixUnitaire, client, destinationId, paye, tauxTVA, notes } = parsed.data
    const prixTotal = quantite * prixUnitaire

    // Bug cmp8rzcjc (Marc 2026-05-16) — pour une vente d'animal vivant,
    // on exige que `animalId` référence un animal du cheptel de l'utilisateur
    // (statut actif), sinon on crée des ventes fantômes (ex: "Clochette"
    // alors qu'aucun animal ne s'appelle Clochette). On laisse les autres
    // types (oeufs/viande/lait/autre) passer sans contrainte animal.
    if (type === 'animal_vivant') {
      if (!parsed.data.animalId) {
        return NextResponse.json(
          { error: 'Pour une vente d\'animal vivant, sélectionnez un animal du cheptel.' },
          { status: 400 }
        )
      }
      const animal = await prisma.animal.findFirst({
        where: { id: parsed.data.animalId, userId: session.user.id },
        select: { id: true, statut: true },
      })
      if (!animal) {
        return NextResponse.json(
          { error: 'Animal introuvable dans votre cheptel.' },
          { status: 400 }
        )
      }
      if (animal.statut !== 'actif') {
        return NextResponse.json(
          { error: `Cet animal n'est plus actif (statut: ${animal.statut}). Impossible de l'enregistrer en vente.` },
          { status: 400 }
        )
      }
    }

    // QA 2026-05-15 — garde-fou anti-saisie aberrante : Sophie a vu une
    // ligne "999 999 douzaines d'œufs à 4€ = 4M€" remonter en compta.
    // On bloque toute vente unitaire > 100 000 € à la saisie ; les
    // ventes en gros au-dessus passent via un POST dédié confirmé.
    const SEUIL_VENTE_PRODUIT = 100_000
    if (prixTotal > SEUIL_VENTE_PRODUIT) {
      return NextResponse.json(
        {
          error: `Saisie aberrante : ${quantite} ${unite ?? 'unités'} × ${prixUnitaire} € = ${prixTotal.toFixed(2)} €. Au-dessus de ${SEUIL_VENTE_PRODUIT} €, contactez l'administrateur ou découpez la saisie.`,
        },
        { status: 400 }
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const vente = await tx.venteProduit.create({
        data: {
          userId: session.user.id,
          date: date || new Date(),
          type,
          description,
          quantite,
          unite,
          prixUnitaire,
          prixTotal,
          client,
          destinationId,
          paye,
          tauxTVA,
          notes,
        },
        include: {
          destination: true,
        },
      })

      // Si vente d'animal vivant, mettre à jour le statut de l'animal
      if (type === 'animal_vivant' && parsed.data.animalId) {
        const animal = await tx.animal.findFirst({
          where: { id: parsed.data.animalId, userId: session.user.id },
        })
        if (animal) {
          await tx.animal.update({
            where: { id: animal.id },
            data: {
              statut: 'vendu',
              dateSortie: date || new Date(),
              causeSortie: 'Vente',
            },
          })
        }
      }

      return vente
    })

    // Auto-comptabilite : creer une vente manuelle
    try {
      await createVenteFromVenteProduit(session.user.id, {
        id: result.id,
        type: result.type,
        description: result.description,
        prixTotal: result.prixTotal,
        quantite: result.quantite,
        unite: result.unite,
        prixUnitaire: result.prixUnitaire,
        client: result.client,
        date: result.date,
        tauxTVA: result.tauxTVA,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (vente_produit):', autoComptaError)
    }

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

    // Supprimer les ecritures auto-compta liees
    try {
      await deleteAutoEntry('vente_produit', parseInt(id), 'vente')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (vente_produit):', autoComptaError)
    }

    // Soft-delete : marquer comme annule au lieu de supprimer
    await prisma.venteProduit.update({
      where: { id: parseInt(id) },
      data: { annule: true, dateAnnulation: new Date() },
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
        const tva = existing.tauxTVA || 5.5
        const totalHT = existing.prixTotal / (1 + tva / 100)
        const totalTVA = existing.prixTotal - totalHT

        const facture = await creerFacture(tx, {
          userId,
          // POSTREVIEW — Toujours 'facture' (la sémantique métier est dans objet/sourceType)
          type: 'facture',
          clientId: body.clientId || null,
          clientNom: existing.client || undefined,
          date: existing.date,
          objet: `Vente de ${existing.type} - ${existing.description || ''}`,
          totalHT,
          totalTVA,
          totalTTC: existing.prixTotal,
          statut: 'payee',
          datePaiement: new Date(),
          modePaiement: body.modePaiement || 'especes',
          lignes: [{
            description: `${existing.type} - ${existing.description || ''}`,
            quantite: existing.quantite,
            unite: existing.unite,
            prixUnitaire: existing.prixUnitaire / (1 + tva / 100),
            tauxTVA: tva,
            montantHT: totalHT,
            montantTVA: totalTVA,
            montantTTC: existing.prixTotal,
          }],
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

    // Auto-comptabilite : mettre a jour l'ecriture auto
    try {
      await createVenteFromVenteProduit(userId, {
        id: parseInt(id),
        type: vente.type,
        description: vente.description,
        prixTotal: vente.prixTotal,
        quantite: vente.quantite,
        unite: vente.unite,
        prixUnitaire: vente.prixUnitaire,
        client: vente.client,
        date: vente.date,
        tauxTVA: vente.tauxTVA,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (vente_produit PATCH):', autoComptaError)
    }

    return NextResponse.json({ data: vente })
  } catch (error) {
    console.error('PATCH /api/elevage/ventes error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
