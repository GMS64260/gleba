/**
 * API Routes pour une Récolte spécifique
 * GET /api/recoltes/[id] - Détail d'une recolte
 * PUT /api/recoltes/[id] - Modifier une recolte
 * DELETE /api/recoltes/[id] - Supprimer une recolte
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateRecolteSchema, recoltePatchSchema } from '@/lib/validations'
import { requireAuthApi } from '@/lib/auth-utils'
import { createVenteFromRecolte, deleteAutoEntry } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'
import { creerFacture } from '@/lib/facture-utils'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/recoltes/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id)

    if (isNaN(recolteId)) {
      return NextResponse.json(
        { error: 'ID de récolte invalide' },
        { status: 400 }
      )
    }

    const recolte = await prisma.recolte.findUnique({
      where: {
        id: recolteId,
        userId: session!.user.id,
      },
      include: {
        espece: {
          include: { famille: true },
        },
        culture: {
          include: {
            variete: true,
            planche: true,
            itp: true,
          },
        },
      },
    })

    if (!recolte) {
      return NextResponse.json(
        { error: `Récolte #${id} non trouvée` },
        { status: 404 }
      )
    }

    return NextResponse.json(recolte)
  } catch (error) {
    console.error('GET /api/recoltes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la récolte' },
      { status: 500 }
    )
  }
}

// PUT /api/recoltes/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id)
    const body = await request.json()

    if (isNaN(recolteId)) {
      return NextResponse.json(
        { error: 'ID de récolte invalide' },
        { status: 400 }
      )
    }

    // Validation
    const validationResult = updateRecolteSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const existing = await prisma.recolte.findUnique({
      where: {
        id: recolteId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Récolte #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Mise à jour
    const recolte = await prisma.recolte.update({
      where: { id: recolteId },
      data: validationResult.data,
      include: {
        espece: true,
        culture: true,
      },
    })

    invalidateKpi(session!.user.id)
    return NextResponse.json(recolte)
  } catch (error) {
    console.error('PUT /api/recoltes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la récolte' },
      { status: 500 }
    )
  }
}

// PATCH /api/recoltes/[id] - Mise à jour partielle (vente, perte, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id)

    if (isNaN(recolteId)) {
      return NextResponse.json(
        { error: 'ID de récolte invalide' },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const existing = await prisma.recolte.findUnique({
      where: {
        id: recolteId,
        userId: session!.user.id,
      },
      include: {
        espece: true,
        culture: { include: { variete: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Récolte #${id} non trouvée` },
        { status: 404 }
      )
    }

    const body = await request.json()
    const userId = session!.user.id

    // BUG-07 : validation Zod. Si statut=vendu sans prix/date/client → 400.
    // On préserve l'existant pour les champs non transmis : on construit
    // le payload effectif (body merged sur existing) pour que le refinement
    // n'invalide pas une transition partielle « j'ajoute juste le prix ».
    const effectiveStatut = body.statut ?? existing.statut
    const effectivePayload = {
      ...body,
      statut: effectiveStatut,
      prixKg: body.prixKg ?? existing.prixKg,
      prixTotal: body.prixTotal ?? existing.prixTotal,
      dateVente: body.dateVente ?? existing.dateVente,
      clientId: body.clientId ?? existing.clientId,
      clientNom: body.clientNom ?? existing.clientNom,
    }
    const validation = recoltePatchSchema.safeParse(effectivePayload)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.error.flatten() },
        { status: 400 }
      )
    }

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

    // Transaction atomique : facture + update recolte
    const recolte = await prisma.$transaction(async (tx) => {
      if (body.statut === "vendu" && body.creerFacture && body.prixTotal) {
        const totalHT = body.prixTotal / 1.055
        const totalTVA = body.prixTotal - totalHT
        const espece = existing.espece?.id || 'Légumes'
        const variete = existing.culture?.variete?.id ? ` - ${existing.culture.variete.id}` : ''

        const facture = await creerFacture(tx, {
          userId,
          type: 'facture',
          clientId: body.clientId || null,
          clientNom: body.clientNom,
          objet: `Vente de ${espece}${variete}`,
          totalHT,
          totalTVA,
          totalTTC: body.prixTotal,
          statut: 'payee',
          datePaiement: new Date(),
          modePaiement: 'especes',
          lignes: [{
            description: `${espece}${variete}`,
            quantite: existing.quantite,
            unite: 'kg',
            prixUnitaire: (body.prixKg || 0) / 1.055,
            tauxTVA: 5.5,
            montantHT: totalHT,
            montantTVA: totalTVA,
            montantTTC: body.prixTotal,
          }],
        })

        updateData.factureId = facture.id
      }

      return tx.recolte.update({
        where: { id: recolteId },
        data: updateData,
        include: {
          espece: {
            include: { famille: true },
          },
          culture: {
            include: {
              variete: true,
              planche: true,
            },
          },
        },
      })
    })

    // Auto-comptabilite : gerer les ecritures automatiques
    try {
      if (body.statut === 'vendu' && (body.prixTotal || body.prixKg)) {
        // Recolte marquee comme vendue -> creer une vente auto
        await createVenteFromRecolte(userId, {
          id: recolteId,
          especeId: existing.especeId,
          quantite: existing.quantite,
          prixKg: body.prixKg ?? existing.prixKg,
          prixTotal: body.prixTotal ?? existing.prixTotal,
          clientNom: body.clientNom ?? existing.clientNom,
          clientId: body.clientId ?? existing.clientId,
          dateVente: body.dateVente ?? existing.dateVente,
        })
      } else if (existing.statut === 'vendu' && body.statut && body.statut !== 'vendu') {
        // Recolte qui n'est plus vendue -> supprimer la vente auto
        await deleteAutoEntry('recolte', recolteId, 'vente')
      }
    } catch (autoComptaError) {
      // Ne pas bloquer la requete si l'auto-compta echoue
      console.error('Auto-compta error (recolte):', autoComptaError)
    }

    invalidateKpi(userId)
    return NextResponse.json(recolte)
  } catch (error) {
    console.error('PATCH /api/recoltes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la récolte' },
      { status: 500 }
    )
  }
}

// DELETE /api/recoltes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const recolteId = parseInt(id)

    if (isNaN(recolteId)) {
      return NextResponse.json(
        { error: 'ID de récolte invalide' },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const recolte = await prisma.recolte.findUnique({
      where: {
        id: recolteId,
        userId: session!.user.id,
      },
    })

    if (!recolte) {
      return NextResponse.json(
        { error: `Récolte #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Toujours nettoyer les ecritures auto-compta liees avant de supprimer
    try {
      await deleteAutoEntry('recolte', recolteId, 'vente')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (recolte):', autoComptaError)
    }

    // Suppression
    await prisma.recolte.delete({
      where: { id: recolteId },
    })

    invalidateKpi(session!.user.id)
    return NextResponse.json({ success: true, deleted: recolteId })
  } catch (error) {
    console.error('DELETE /api/recoltes/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la récolte' },
      { status: 500 }
    )
  }
}
