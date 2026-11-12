/**
 * API Mouvements de cheptel (PROMPT 19A §4).
 *
 * GET   ?animalId=&lotId=&from=&to=
 * POST  enregistre un déplacement
 * DELETE id=
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const mouvementSchema = z
  .object({
    animalId: z.coerce.number().int().positive().nullable().optional(),
    lotId: z.coerce.number().int().positive().nullable().optional(),
    parcelleAvantId: z.string().nullable().optional(),
    parcelleApresId: z.string().nullable().optional(),
    date: z.coerce.date(),
    motif: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => Boolean(d.animalId) !== Boolean(d.lotId), {
    message: 'Renseignez un animal ou un lot, pas les deux.',
  })

type CibleMouvement = { animalId: number | null; lotId: number | null }

/**
 * Sérialise les mouvements d'une même bête ou d'un même lot : sans ce verrou,
 * deux saisies concurrentes recalculaient chacune la position sans voir l'autre.
 */
async function verrouillerCible(tx: Prisma.TransactionClient, userId: string, cible: CibleMouvement) {
  if (cible.animalId) await tx.$queryRaw`SELECT id FROM animaux WHERE id = ${cible.animalId} AND user_id = ${userId} FOR UPDATE`
  else if (cible.lotId) await tx.$queryRaw`SELECT id FROM lots_animaux WHERE id = ${cible.lotId} AND user_id = ${userId} FOR UPDATE`
}

/**
 * Revue Codex ELEV-05 (2026-11-12). Toute écriture de `parcelleGeoId` journalise
 * un mouvement : le journal fait foi. La position courante est la destination
 * du mouvement le plus récent par date (à date égale, le dernier saisi) ; sans
 * mouvement, `repli`. Avant, un POST antidaté écrasait la position, et la
 * suppression du seul mouvement A→B laissait la bête sans parcelle.
 */
async function recalerPosition(tx: Prisma.TransactionClient, userId: string, cible: CibleMouvement, repli: string | null) {
  const dernier = await tx.mouvementCheptel.findFirst({
    where: { userId, ...(cible.animalId ? { animalId: cible.animalId } : { lotId: cible.lotId }) },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { parcelleApresId: true },
  })
  const parcelleGeoId = dernier ? dernier.parcelleApresId : repli
  if (cible.animalId) await tx.animal.updateMany({ where: { id: cible.animalId, userId }, data: { parcelleGeoId } })
  else if (cible.lotId) await tx.lotAnimaux.updateMany({ where: { id: cible.lotId, userId }, data: { parcelleGeoId } })
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const animalId = searchParams.get('animalId')
  const lotId = searchParams.get('lotId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Prisma.MouvementCheptelWhereInput = { userId: session.user.id }
  if (animalId) where.animalId = parseInt(animalId, 10)
  if (lotId) where.lotId = parseInt(lotId, 10)
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const mouvements = await prisma.mouvementCheptel.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      animal: { select: { id: true, nom: true, identifiant: true } },
      lot: { select: { id: true, nom: true } },
      parcelleAvant: { select: { id: true, nom: true } },
      parcelleApres: { select: { id: true, nom: true } },
    },
  })

  return NextResponse.json({ data: mouvements })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = mouvementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const userId = session.user.id

    // POSTREVIEW Sprint 5 — Validation tenant : chaque ressource référencée
    // doit appartenir au user authentifié (avant : IDOR exploitable trivialement)
    if (d.animalId) {
      const a = await prisma.animal.findFirst({ where: { id: d.animalId, userId }, select: { id: true } })
      if (!a) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
    }
    if (d.lotId) {
      const l = await prisma.lotAnimaux.findFirst({ where: { id: d.lotId, userId }, select: { id: true } })
      if (!l) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }
    if (d.parcelleAvantId) {
      const p = await prisma.parcelleGeo.findFirst({ where: { id: d.parcelleAvantId, userId }, select: { id: true } })
      if (!p) return NextResponse.json({ error: 'Parcelle origine introuvable' }, { status: 404 })
    }
    if (d.parcelleApresId) {
      const p = await prisma.parcelleGeo.findFirst({ where: { id: d.parcelleApresId, userId }, select: { id: true } })
      if (!p) return NextResponse.json({ error: 'Parcelle destination introuvable' }, { status: 404 })
    }

    // Le journal et l'emplacement courant forment une seule opération : une
    // erreur ne doit jamais laisser la carte et l'historique en désaccord.
    const m = await prisma.$transaction(async (tx) => {
      await verrouillerCible(tx, userId, { animalId: d.animalId ?? null, lotId: d.lotId ?? null })
      const mouvement = await tx.mouvementCheptel.create({
        data: {
          userId,
          animalId: d.animalId ?? null,
          lotId: d.lotId ?? null,
          parcelleAvantId: d.parcelleAvantId ?? null,
          parcelleApresId: d.parcelleApresId ?? null,
          date: d.date,
          motif: d.motif ?? null,
          notes: d.notes ?? null,
        },
      })

      // Un mouvement antidaté complète l'historique sans déplacer la bête :
      // la position reste celle du mouvement le plus récent (ELEV-05).
      await recalerPosition(tx, userId, { animalId: d.animalId ?? null, lotId: d.lotId ?? null }, d.parcelleApresId ?? null)
      return mouvement
    })

    return NextResponse.json({ data: m }, { status: 201 })
  } catch (err) {
    console.error('POST /api/elevage/mouvements-cheptel error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const existing = await prisma.mouvementCheptel.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Mouvement non trouvé' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    const cible = { animalId: existing.animalId, lotId: existing.lotId }
    await verrouillerCible(tx, session.user.id, cible)
    await tx.mouvementCheptel.delete({ where: { id } })
    // Sans mouvement restant, la bête retourne d'où ce mouvement l'avait sortie
    // (ELEV-05) : la parcelle d'origine est enregistrée, elle n'est pas perdue.
    await recalerPosition(tx, session.user.id, cible, existing.parcelleAvantId)
  })
  return NextResponse.json({ success: true })
}
