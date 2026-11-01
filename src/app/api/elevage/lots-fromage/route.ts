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
import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
import { ErreurElevage } from '@/lib/elevage/erreurs'

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
      await verrouillerReglements(tx, session.user.id)
      const numero = await prochainNumeroLot(tx, session.user.id, data.dateFabrication)

      // Vérifie que les collectes existent, appartiennent au user et ne sont pas déjà affectées
      let collectesValides: typeof body.collecteIds = []
      if (data.collecteIds && data.collecteIds.length > 0) {
        const collectes = await tx.collecteLait.findMany({
          where: { id: { in: data.collecteIds }, userId: session.user.id },
        })
        if (collectes.length !== new Set(data.collecteIds).size) throw new ErreurElevage('Une ou plusieurs collectes sont introuvables dans votre élevage.', 400)
        const refusees = collectes.filter((c) => c.lotFromageId && c.lotFromageId.length > 0)
        if (refusees.length > 0) {
          throw new Error(`${refusees.length} collecte(s) déjà affectée(s) à un autre lot.`)
        }
        const ecartees = collectes.filter((c) => c.ecarteAttente)
        if (ecartees.length > 0) {
          throw new Error(`${ecartees.length} collecte(s) sont écartées (temps d'attente vétérinaire) — non transformables.`)
        }
        // Revue du 2026-11-01 — une collecte est affectée entière à un seul lot :
        // le volume déclaré doit être celui des collectes choisies. L'API
        // acceptait 1 L déclaré pour une collecte de 10 L, qui disparaissait
        // ensuite du lait disponible. L'écran envoie déjà cette somme.
        const volumeCollectes = collectes.reduce((total, c) => total + Number(c.quantiteLitres), 0)
        if (Math.abs(volumeCollectes - data.volumeLaitUtiliseL) > 0.01) {
          const litres = (v: number) => `${Math.round(v * 100) / 100} L`
          throw new ErreurElevage(
            `Le volume déclaré (${litres(data.volumeLaitUtiliseL)}) ne correspond pas aux collectes choisies (${litres(volumeCollectes)}). Une collecte est affectée en entier à une fabrication : déclarez ${litres(volumeCollectes)} ou changez la sélection.`,
            422,
          )
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
  } catch (err) {
    if (err instanceof ErreurElevage) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('POST /api/elevage/lots-fromage error:', err)
    return NextResponse.json({ error: (err instanceof Error && err.message) || 'Erreur interne du serveur' }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  try {
    await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session.user.id)
      const existing = await tx.lotFromage.findFirst({
        where: { id, userId: session.user.id },
        include: { _count: { select: { ventesProduit: true, mouvements: true } } },
      })
      if (!existing) throw new ErreurElevage('Lot non trouvé', 404)
      if (existing._count.ventesProduit || existing._count.mouvements) {
        throw new ErreurElevage('Ce lot possède des ventes ou des sorties de cave. Suppression refusée pour préserver la traçabilité.')
      }
      await tx.collecteLait.updateMany({ where: { lotFromageId: id, userId: session.user.id }, data: { lotFromageId: null } })
      await tx.lotFromage.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ErreurElevage) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('DELETE /api/elevage/lots-fromage error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
