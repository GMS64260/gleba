/**
 * API Consommations d'aliments (elevage)
 * GET /api/elevage/consommations-aliments - Liste avec filtres
 * POST /api/elevage/consommations-aliments - Créer + décrémenter stock
 * DELETE /api/elevage/consommations-aliments - Supprimer + ré-incrémenter stock
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createDepenseFromConsommationAliment, deleteAutoEntry } from '@/lib/auto-compta'
import { consommationAlimentSchema } from '@/lib/validations/consommation-aliment'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const alimentId = searchParams.get('alimentId')
    const lotId = searchParams.get('lotId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const limit = parseInt(searchParams.get('limit') || '100')
    const annee = parseInt(searchParams.get('annee') || String(new Date().getFullYear()))
    const yearStart = new Date(annee, 0, 1)
    const yearEnd = new Date(annee, 11, 31, 23, 59, 59)

    const where: any = { userId, date: { gte: yearStart, lte: yearEnd } }
    if (alimentId) where.alimentId = alimentId
    if (lotId) where.lotId = parseInt(lotId)
    if (dateDebut || dateFin) {
      if (dateDebut) where.date.gte = new Date(dateDebut)
      if (dateFin) where.date.lte = new Date(dateFin)
    }

    const consommations = await prisma.consommationAliment.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        aliment: {
          select: { id: true, nom: true, type: true },
        },
        lot: {
          select: { id: true, nom: true },
        },
      },
    })

    // Stats agrégées
    const stats = await prisma.consommationAliment.aggregate({
      where,
      _sum: { quantite: true },
      _count: true,
    })

    // Répartition par aliment
    const parAliment = await prisma.consommationAliment.groupBy({
      by: ['alimentId'],
      where,
      _sum: { quantite: true },
      _count: true,
    })

    // Récupérer les noms d'aliments
    const alimentIds = parAliment.map(a => a.alimentId)
    const aliments = await prisma.aliment.findMany({
      where: { id: { in: alimentIds } },
      select: { id: true, nom: true },
    })
    const alimentMap = new Map(aliments.map(a => [a.id, a.nom]))

    return NextResponse.json({
      data: consommations,
      stats: {
        totalKg: stats._sum.quantite || 0,
        nbEnregistrements: stats._count,
        parAliment: parAliment.map(a => ({
          alimentId: a.alimentId,
          nom: alimentMap.get(a.alimentId) || a.alimentId,
          totalKg: a._sum.quantite || 0,
          count: a._count,
        })),
      },
      meta: { year: annee, total: consommations.length },
    })
  } catch (error) {
    console.error('GET /api/elevage/consommations-aliments error:', error)
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
    const userId = session.user.id
    const body = await request.json()

    // Validation
    const result = consommationAlimentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { alimentId, lotId, date, quantite, notes } = result.data
    const overrideStock = (body as { overrideStock?: boolean })?.overrideStock === true

    // Review caprin 2026-07-21 — valider l'appartenance du lot (IDOR-lite) :
    // sans ça, une conso pouvait être affectée au lot d'un autre compte ou à un
    // lot inexistant (les animaux, eux, validaient déjà via isAssignableAnimalLot).
    if (lotId != null) {
      const lot = await prisma.lotAnimaux.findFirst({ where: { id: lotId, userId }, select: { id: true } })
      if (!lot) return NextResponse.json({ error: 'Lot introuvable dans votre cheptel.' }, { status: 400 })
    }

    // Feedback Marc 2026-05-16 — V3 Bug 4 : on refusait pas une saisie
    // qui faisait basculer le stock en négatif, ce qui aboutissait à
    // -10/-20 kg en base. On garde la possibilité de forcer (via
    // `overrideStock`) pour les éleveurs qui consomment avant d'avoir
    // saisi un approvisionnement.
    //
    // Bug feedback testeur 2026-05-25 (cmplkce65/cmplk4qpj) — Si l'aliment
    // n'a JAMAIS été initialisé (UserStockAliment inexistant), on refuse la
    // saisie en l'identifiant comme code distinct STOCK_NON_INITIALISE.
    // Cela évite qu'un stock implicite à 0 fasse passer immédiatement en
    // négatif sans que l'éleveur ait conscience que le stock n'avait pas
    // été renseigné.
    const existing = await prisma.userStockAliment.findUnique({
      where: { userId_alimentId: { userId, alimentId } },
      select: { stock: true },
    })

    if (!overrideStock && existing === null) {
      return NextResponse.json(
        {
          error: 'Stock non initialisé',
          code: 'STOCK_NON_INITIALISE',
          details: {
            message: `Le stock de cet aliment n'a jamais été renseigné. Initialisez-le d'abord depuis l'onglet « Stocks » (ou confirmez pour enregistrer la consommation et laisser le stock partir en négatif).`,
          },
        },
        { status: 422 }
      )
    }

    if (!overrideStock) {
      const stockActuel = existing?.stock ?? 0
      if (stockActuel - quantite < 0) {
        return NextResponse.json(
          {
            error: 'Stock insuffisant',
            code: 'STOCK_INSUFFISANT',
            details: {
              stockActuel,
              quantiteDemandee: quantite,
              manque: Math.round((quantite - stockActuel) * 100) / 100,
              message: `Stock actuel : ${stockActuel} — ${quantite} consommé(s) ferait passer le stock à ${stockActuel - quantite}. Approvisionnez le stock ou cochez « forcer » pour confirmer.`,
            },
          },
          { status: 422 }
        )
      }
    }

    // Transaction : créer la consommation + décrémenter le stock
    const [consommation] = await prisma.$transaction([
      prisma.consommationAliment.create({
        data: {
          userId,
          alimentId,
          lotId: lotId ?? null,
          date,
          quantite,
          notes: notes ?? null,
        },
        include: {
          aliment: { select: { id: true, nom: true, type: true } },
          lot: { select: { id: true, nom: true } },
        },
      }),
      // Décrémenter le stock per-user
      prisma.userStockAliment.upsert({
        where: { userId_alimentId: { userId, alimentId } },
        create: {
          userId,
          alimentId,
          stock: overrideStock ? -quantite : 0,
          dateStock: new Date(),
        },
        update: {
          stock: { decrement: quantite },
          dateStock: new Date(),
        },
      }),
    ])

    // Auto-comptabilite : creer la depense auto (valorisation au prix du stock)
    try {
      await createDepenseFromConsommationAliment(userId, {
        id: consommation.id,
        alimentId: consommation.alimentId,
        quantite: consommation.quantite,
        date: consommation.date,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (consommation_aliment POST):', autoComptaError)
    }

    return NextResponse.json({ data: consommation }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/consommations-aliments error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// QA 2026-05-15 — édition par bouton ✏️ depuis l'onglet Consommations.
// On recalcule l'impact stock : delta = nouvelle quantité - ancienne ;
// puis on applique le delta sur UserStockAliment.
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const userId = session.user.id
    const body = await request.json()
    const id = parseInt(body.id, 10)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }
    const existing = await prisma.consommationAliment.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Consommation introuvable' }, { status: 404 })
    }

    const result = consommationAlimentSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: result.error.flatten() },
        { status: 400 }
      )
    }
    const { alimentId, lotId, date, quantite, notes } = result.data

    // Review caprin 2026-07-21 — valider l'appartenance du lot (cf. POST).
    if (lotId != null) {
      const lot = await prisma.lotAnimaux.findFirst({ where: { id: lotId, userId }, select: { id: true } })
      if (!lot) return NextResponse.json({ error: 'Lot introuvable dans votre cheptel.' }, { status: 400 })
    }

    // Transaction interactive : on rend l'impact stock à l'ancien aliment
    // si changement, puis on applique le delta sur le nouvel.
    const updated = await prisma.$transaction(async (tx) => {
      if (existing.alimentId !== alimentId) {
        await tx.userStockAliment.upsert({
          where: { userId_alimentId: { userId, alimentId: existing.alimentId } },
          create: { userId, alimentId: existing.alimentId, stock: existing.quantite, dateStock: new Date() },
          update: { stock: { increment: existing.quantite }, dateStock: new Date() },
        })
        await tx.userStockAliment.upsert({
          where: { userId_alimentId: { userId, alimentId } },
          create: { userId, alimentId, stock: -quantite, dateStock: new Date() },
          update: { stock: { decrement: quantite }, dateStock: new Date() },
        })
      } else {
        const delta = quantite - existing.quantite
        if (delta !== 0) {
          await tx.userStockAliment.upsert({
            where: { userId_alimentId: { userId, alimentId } },
            create: { userId, alimentId, stock: -delta, dateStock: new Date() },
            update: { stock: { decrement: delta }, dateStock: new Date() },
          })
        }
      }
      return tx.consommationAliment.update({
        where: { id },
        data: {
          alimentId,
          lotId: lotId ?? null,
          date,
          quantite,
          notes: notes ?? null,
        },
        include: {
          aliment: { select: { id: true, nom: true, type: true } },
          lot: { select: { id: true, nom: true } },
        },
      })
    })
    // Auto-comptabilite : resynchroniser la depense auto avec les valeurs finales
    try {
      await createDepenseFromConsommationAliment(userId, {
        id: updated.id,
        alimentId: updated.alimentId,
        quantite: updated.quantite,
        date: updated.date,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (consommation_aliment PATCH):', autoComptaError)
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('PATCH /api/elevage/consommations-aliments error:', error)
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
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const consId = parseInt(id)

    // Vérifier ownership et récupérer les données
    const existing = await prisma.consommationAliment.findFirst({
      where: { id: consId, userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Consommation non trouvée' }, { status: 404 })
    }

    // Supprimer les ecritures auto-compta liees
    try {
      await deleteAutoEntry('consommation_aliment', consId, 'depense')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (consommation_aliment):', autoComptaError)
    }

    // Transaction : supprimer + ré-incrémenter le stock
    await prisma.$transaction([
      prisma.consommationAliment.delete({
        where: { id: consId },
      }),
      // Ré-incrémenter le stock per-user
      prisma.userStockAliment.upsert({
        where: { userId_alimentId: { userId, alimentId: existing.alimentId } },
        create: {
          userId,
          alimentId: existing.alimentId,
          stock: existing.quantite,
          dateStock: new Date(),
        },
        update: {
          stock: { increment: existing.quantite },
          dateStock: new Date(),
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/consommations-aliments error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
