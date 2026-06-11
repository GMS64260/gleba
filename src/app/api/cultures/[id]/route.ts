/**
 * API Routes pour une Culture spécifique
 * GET /api/cultures/[id] - Détail d'une culture
 * PUT /api/cultures/[id] - Modifier une culture
 * DELETE /api/cultures/[id] - Supprimer une culture
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateCultureSchema } from '@/lib/validations'
import { validateCultureDates } from '@/lib/validations/date-validation'
import { requireAuthApi } from '@/lib/auth-utils'
import { irrigationCache } from '@/lib/irrigation-cache'
import { invalidateKpi } from '@/lib/kpi'

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/cultures/[id]
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const cultureId = parseInt(id)

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    const culture = await prisma.culture.findUnique({
      where: {
        id: cultureId,
        userId: session!.user.id,
      },
      include: {
        espece: {
          include: { famille: true },
        },
        variete: {
          include: { fournisseur: true },
        },
        itp: true,
        planche: {
          include: { rotation: true },
        },
        recoltes: {
          orderBy: { date: 'desc' },
        },
      },
    })

    if (!culture) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Ajouter les champs calculés
    const cultureWithComputed = {
      ...culture,
      etat: culture.terminee
        ? 'Terminée'
        : culture.recolteFaite
          ? 'En récolte'
          : culture.plantationFaite
            ? 'Plantée'
            : culture.semisFait
              ? 'Semée'
              : 'Planifiée',
      totalRecolte: culture.recoltes.reduce((sum, r) => sum + r.quantite, 0),
    }

    return NextResponse.json(cultureWithComputed)
  } catch (error) {
    console.error('GET /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la culture' },
      { status: 500 }
    )
  }
}

// PUT /api/cultures/[id]
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const cultureId = parseInt(id)
    const body = await request.json()

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    // Validation
    const validationResult = updateCultureSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const existing = await prisma.culture.findUnique({
      where: {
        id: cultureId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Audit Marc 2026-05-14 — Bug 04 : valider les dates contre l'ITP en
    // modification également (warnings non bloquants remontés au client).
    const dateWarnings: string[] = []
    const data = validationResult.data
    if (data.dateSemis || data.datePlantation || data.dateRecolte) {
      try {
        const itpId = data.itpId ?? existing.itpId
        const itp = itpId
          ? await prisma.iTP.findUnique({
              where: { id: itpId },
              select: { semaineSemis: true, semainePlantation: true, semaineRecolte: true },
            })
          : null
        const annee = data.annee ?? existing.annee ?? new Date().getFullYear()
        const v = validateCultureDates({
          dateSemis: data.dateSemis ?? existing.dateSemis,
          datePlantation: data.datePlantation ?? existing.datePlantation,
          dateRecolte: data.dateRecolte ?? existing.dateRecolte,
          itp,
          annee,
        })
        dateWarnings.push(...v.warnings)
      } catch (e) {
        console.warn('Date validation PUT skipped:', e)
      }
    }

    // Bug testeur 2026-05-31 — Longueur de culture > longueur de planche : la
    // création (POST) bloque déjà via peutAjouterCulture(), mais l'édition ne
    // vérifiait rien. On remonte un warning non bloquant (comme les dates).
    const plancheId = data.plancheId ?? existing.plancheId
    const longueurCulture = data.longueur ?? existing.longueur
    if (plancheId && longueurCulture) {
      try {
        const planche = await prisma.planche.findFirst({
          where: { id: plancheId, userId: session!.user.id },
          select: { nom: true, longueur: true },
        })
        if (planche?.longueur && longueurCulture > planche.longueur) {
          dateWarnings.push(
            `Longueur de la culture (${longueurCulture} m) supérieure à la longueur de la planche ${planche.nom} (${planche.longueur} m).`
          )
        }
      } catch (e) {
        console.warn('Longueur validation PUT skipped:', e)
      }
    }

    // Mise à jour
    const culture = await prisma.culture.update({
      where: { id: cultureId },
      data: validationResult.data,
      include: {
        espece: true,
        variete: true,
        itp: true,
        planche: true,
      },
    })

    invalidateKpi(session!.user.id)
    return NextResponse.json(
      dateWarnings.length > 0 ? { ...culture, warnings: dateWarnings } : culture
    )
  } catch (error) {
    console.error('PUT /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la culture' },
      { status: 500 }
    )
  }
}

// PATCH /api/cultures/[id] - Mise a jour partielle rapide (pour actions rapides)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const cultureId = parseInt(id)
    const body = await request.json()

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    // Verifier existence et propriete
    const existing = await prisma.culture.findUnique({
      where: {
        id: cultureId,
        userId: session!.user.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvee` },
        { status: 404 }
      )
    }

    // Champs autorises pour PATCH rapide
    const allowedFields = [
      'semisFait',
      'plantationFaite',
      'recolteFaite',
      'terminee',
      'aIrriguer',
      'derniereIrrigation',
      'dateSemis',
      'datePlantation',
      'dateRecolte',
      'notes',
    ]

    const dateFields = ['dateSemis', 'datePlantation', 'dateRecolte', 'derniereIrrigation']
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        // Convertir les chaînes ISO en Date pour les champs DateTime
        if (dateFields.includes(field) && body[field]) {
          updateData[field] = new Date(body[field])
        } else {
          updateData[field] = body[field]
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Aucun champ valide a mettre a jour' },
        { status: 400 }
      )
    }

    const culture = await prisma.culture.update({
      where: { id: cultureId },
      data: updateData,
    })

    // Invalider le cache irrigation si la date d'arrosage a changé
    if ('derniereIrrigation' in updateData) {
      irrigationCache.invalidateUser(session!.user.id)
    }

    invalidateKpi(session!.user.id)
    return NextResponse.json(culture)
  } catch (error) {
    console.error('PATCH /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de la culture' },
      { status: 500 }
    )
  }
}

// DELETE /api/cultures/[id]
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const cultureId = parseInt(id)

    if (isNaN(cultureId)) {
      return NextResponse.json(
        { error: 'ID de culture invalide' },
        { status: 400 }
      )
    }

    // Vérifier existence et propriété
    const culture = await prisma.culture.findUnique({
      where: {
        id: cultureId,
        userId: session!.user.id,
      },
    })

    if (!culture) {
      return NextResponse.json(
        { error: `Culture #${id} non trouvée` },
        { status: 404 }
      )
    }

    // Audit compta 2026-06 : les récoltes partent en cascade DB, mais leurs
    // écritures auto-compta et leur part d'inventaire ne suivent pas — il
    // restait des VenteManuelle orphelines comptées à vie dans le KPI.
    const recoltes = await prisma.recolte.findMany({
      where: { cultureId, userId: session!.user.id },
      select: { id: true, especeId: true, quantite: true, statut: true },
    })

    await prisma.$transaction(async (tx) => {
      if (recoltes.length > 0) {
        await tx.venteManuelle.deleteMany({
          where: {
            sourceType: 'recolte',
            sourceId: { in: recoltes.map((r) => r.id) },
            auto: true,
          },
        })

        // Décrément de l'inventaire pour les récoltes encore comptées en stock
        const deltaParEspece = new Map<string, number>()
        for (const r of recoltes) {
          if (r.statut === 'en_stock' && r.quantite > 0) {
            deltaParEspece.set(r.especeId, (deltaParEspece.get(r.especeId) ?? 0) + r.quantite)
          }
        }
        for (const [especeId, delta] of deltaParEspece) {
          const stock = await tx.userStockEspece.findUnique({
            where: { userId_especeId: { userId: session!.user.id, especeId } },
            select: { inventaire: true },
          })
          const inventaire = Math.max(0, (stock?.inventaire ?? 0) - delta)
          await tx.userStockEspece.upsert({
            where: { userId_especeId: { userId: session!.user.id, especeId } },
            create: { userId: session!.user.id, especeId, inventaire, dateInventaire: new Date() },
            update: { inventaire, dateInventaire: new Date() },
          })
        }
      }

      // Suppression (les recoltes seront supprimées en cascade)
      await tx.culture.delete({
        where: { id: cultureId },
      })
    })

    invalidateKpi(session!.user.id)
    return NextResponse.json({ success: true, deleted: cultureId })
  } catch (error) {
    console.error('DELETE /api/cultures/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la culture' },
      { status: 500 }
    )
  }
}
