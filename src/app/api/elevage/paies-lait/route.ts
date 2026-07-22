/**
 * API Paie du lait mensuelle (PROMPT 26).
 * GET ?annee= / POST (upsert par mois) / DELETE?id=
 * Le montant est recalculé serveur (litres, prix base, prime, pénalité).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { montantPaie } from '@/lib/elevage/paie-lait'
import { upsertVenteFromPaieLait } from '@/lib/auto-compta'

const schema = z.object({
  annee: z.coerce.number().int(),
  mois: z.coerce.number().int().min(1).max(12),
  litres: z.coerce.number().min(0),
  prixBaseMille: z.coerce.number().min(0),
  primeQualite: z.coerce.number().default(0),
  penalite: z.coerce.number().default(0),
  laiterie: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const annee = parseInt(searchParams.get('annee') || `${new Date().getFullYear()}`, 10)
  const paies = await prisma.paieLait.findMany({
    where: { userId: session.user.id, annee },
    orderBy: { mois: 'asc' },
  })
  const montantTotal = paies.reduce((s, p) => s + Number(p.montantHT), 0)
  const litresTotal = paies.reduce((s, p) => s + Number(p.litres), 0)
  return NextResponse.json({
    data: paies,
    stats: {
      annee,
      montantTotal: Math.round(montantTotal * 100) / 100,
      litresTotal: Math.round(litresTotal * 100) / 100,
      prixMoyenMille: litresTotal > 0 ? Math.round((montantTotal / litresTotal) * 1000 * 100) / 100 : null,
    },
  })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const d = parsed.data
    const montant = montantPaie(d.litres, d.prixBaseMille, d.primeQualite, d.penalite)
    const userId = session.user.id
    // Upsert par mois (une paie par mois)
    const paie = await prisma.$transaction(async (tx) => {
      const saved = await tx.paieLait.upsert({
        where: { userId_annee_mois: { userId, annee: d.annee, mois: d.mois } },
        update: {
        litres: d.litres,
        prixBaseMille: d.prixBaseMille,
        primeQualite: d.primeQualite,
        penalite: d.penalite,
        montantHT: montant,
        laiterie: d.laiterie ?? null,
        notes: d.notes ?? null,
      },
        create: {
        userId,
        annee: d.annee,
        mois: d.mois,
        litres: d.litres,
        prixBaseMille: d.prixBaseMille,
        primeQualite: d.primeQualite,
        penalite: d.penalite,
        montantHT: montant,
        laiterie: d.laiterie ?? null,
        notes: d.notes ?? null,
        },
      })
      await upsertVenteFromPaieLait(tx, userId, {
        annee: d.annee,
        mois: d.mois,
        montantHT: montant,
        litres: d.litres,
        laiterie: d.laiterie ?? null,
      })
      return saved
    })

    return NextResponse.json({ data: paie }, { status: 201 })
  } catch (err) {
    console.error('POST /api/elevage/paies-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })
  const existing = await prisma.paieLait.findFirst({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Paie introuvable' }, { status: 404 })
  await prisma.$transaction(async (tx) => {
    await tx.paieLait.delete({ where: { id } })
    await tx.venteManuelle.deleteMany({
      where: {
        sourceType: 'paie_lait',
        sourceId: existing.annee * 100 + existing.mois,
        auto: true,
        userId: existing.userId,
      },
    })
  })

  return NextResponse.json({ success: true })
}
