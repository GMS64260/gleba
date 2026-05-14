/**
 * API Lots Fromage (PROMPT 17).
 *
 * GET   ?year=2026
 * POST  crée un lot : numéro auto L-YYYY-Www-NN, affecte des collectes
 *       et décrémente le volume disponible (les collectes affectées
 *       perdent leur statut "disponible").
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { lotFromageSchema } from '@/lib/validations/lait'
import { prochainNumeroLot } from '@/lib/lait'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10)
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59)

  const lots = await prisma.lotFromage.findMany({
    where: { userId: session.user.id, dateFabrication: { gte: start, lte: end } },
    orderBy: { dateFabrication: 'desc' },
    include: {
      collectes: { select: { id: true, date: true, quantiteLitres: true, animalId: true, lotId: true } },
      ventesProduit: { select: { id: true, date: true, quantite: true, prixTotal: true } },
    },
  })

  return NextResponse.json({ data: lots })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = lotFromageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const result = await prisma.$transaction(async (tx) => {
      const numero = await prochainNumeroLot(tx, session.user.id, data.dateFabrication)

      // Vérifie que les collectes existent, appartiennent au user et ne sont pas déjà affectées
      let collectesValides: typeof body.collecteIds = []
      if (data.collecteIds && data.collecteIds.length > 0) {
        const collectes = await tx.collecteLait.findMany({
          where: { id: { in: data.collecteIds }, userId: session.user.id },
        })
        const refusees = collectes.filter((c) => c.lotFromageId && c.lotFromageId.length > 0)
        if (refusees.length > 0) {
          throw new Error(`${refusees.length} collecte(s) déjà affectée(s) à un autre lot.`)
        }
        const ecartees = collectes.filter((c) => c.ecarteAttente)
        if (ecartees.length > 0) {
          throw new Error(`${ecartees.length} collecte(s) sont écartées (temps d'attente vétérinaire) — non transformables.`)
        }
        collectesValides = collectes.map((c) => c.id)
      }

      const lot = await tx.lotFromage.create({
        data: {
          userId: session.user.id,
          numeroLot: numero,
          dateFabrication: data.dateFabrication,
          typeFromage: data.typeFromage,
          volumeLaitUtiliseL: data.volumeLaitUtiliseL,
          nbPieces: data.nbPieces,
          poidsTotalKg: data.poidsTotalKg,
          dluo: data.dluo ?? null,
          statutBioSnapshot: data.statutBioSnapshot ?? null,
          traitementThermique: data.traitementThermique ?? 'cru',
          allergenes: data.allergenes ?? null,
          numeroAgrement: data.numeroAgrement ?? null,
          notes: data.notes ?? null,
        },
      })

      if (collectesValides.length > 0) {
        await tx.collecteLait.updateMany({
          where: { id: { in: collectesValides } },
          data: { lotFromageId: lot.id },
        })
      }

      return lot
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/elevage/lots-fromage error:', err)
    return NextResponse.json({ error: err.message || 'Erreur interne du serveur' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const existing = await prisma.lotFromage.findFirst({
    where: { id, userId: session.user.id },
    include: { ventesProduit: { select: { id: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })

  if (existing.ventesProduit.length > 0) {
    return NextResponse.json(
      { error: 'Lot lié à une ou plusieurs ventes — suppression refusée pour préserver la traçabilité.' },
      { status: 409 }
    )
  }

  await prisma.$transaction(async (tx) => {
    // Détache les collectes (gardées pour traçabilité)
    await tx.collecteLait.updateMany({ where: { lotFromageId: id }, data: { lotFromageId: null } })
    await tx.lotFromage.delete({ where: { id } })
  })

  return NextResponse.json({ success: true })
}
