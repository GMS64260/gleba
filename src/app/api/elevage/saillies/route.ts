/**
 * API Saillies (PROMPT 18).
 *
 * GET    ?statut=&from=&to=&femelleId=  → liste
 * POST   crée une saillie (calcule auto date_mise_bas_attendue depuis l'espèce)
 * PATCH  met à jour (confirmation gestation, statut, notes)
 * DELETE id=
 *
 * À la création, si une consanguinité est détectée entre femelle et mâle
 * (ancêtre commun sur 3 générations), un avertissement non bloquant est
 * inclus dans la réponse — l'éleveur peut maintenir la saillie ou annuler.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { saillieSchema, updateSaillieSchema } from '@/lib/validations/saillie'
import {
  dateMiseBasAttendue,
  dateTarissementPrevue,
  detecterConsanguinite,
  DUREE_GESTATION_DEFAUTS,
} from '@/lib/reproduction'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const statut = searchParams.get('statut')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const femelleId = searchParams.get('femelleId')

  const where: any = { userId: session.user.id }
  if (statut) where.statut = statut
  if (femelleId) where.femelleId = parseInt(femelleId, 10)
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) where.date.lte = new Date(to)
  }

  const saillies = await prisma.saillie.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      femelle: {
        select: { id: true, nom: true, identifiant: true, race: true, especeAnimale: { select: { id: true, nom: true } } },
      },
      male: { select: { id: true, nom: true, identifiant: true, race: true } },
      miseBas: { select: { id: true, date: true, nombreNes: true, nombreVivants: true } },
    },
  })

  return NextResponse.json({ data: saillies })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = saillieSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    // Récupère l'espèce de la femelle pour calculer la durée gestation
    const femelle = await prisma.animal.findFirst({
      where: { id: data.femelleId, userId: session.user.id },
      include: { especeAnimale: true },
    })
    if (!femelle) return NextResponse.json({ error: 'Femelle introuvable' }, { status: 404 })
    if (femelle.sexe && femelle.sexe !== 'femelle') {
      return NextResponse.json({ error: 'L\'animal sélectionné n\'est pas une femelle' }, { status: 400 })
    }

    // Audit élevage 2026-06-11 — validation tenant du mâle (la femelle
    // l'est déjà ci-dessus).
    if (data.maleId) {
      const male = await prisma.animal.findFirst({
        where: { id: data.maleId, userId: session.user.id },
        select: { id: true },
      })
      if (!male) return NextResponse.json({ error: 'Mâle introuvable' }, { status: 404 })
    }

    const duree =
      femelle.especeAnimale.dureeGestation ??
      DUREE_GESTATION_DEFAUTS[femelle.especeAnimale.id.toLowerCase()] ??
      DUREE_GESTATION_DEFAUTS[(femelle.especeAnimale.type || '').toLowerCase()]
    if (!duree) {
      return NextResponse.json(
        { error: `Durée de gestation inconnue pour l'espèce ${femelle.especeAnimale.nom}. Configurez-la dans Espèces.` },
        { status: 400 }
      )
    }

    const dateMb = dateMiseBasAttendue(data.date, duree)
    const dateTar = dateTarissementPrevue(dateMb, femelle.especeAnimale.production)

    // Détection consanguinité (informative, non bloquante)
    let consanguinite: number[] = []
    if (data.maleId) {
      consanguinite = await detecterConsanguinite(prisma, data.femelleId, data.maleId, 3, session.user.id)
    }

    // PROMPT 24 — validation tenant de la campagne rattachée
    if (data.campagneId) {
      const c = await prisma.campagneReproduction.findFirst({
        where: { id: data.campagneId, userId: session.user.id },
        select: { id: true },
      })
      if (!c) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
    }

    const saillie = await prisma.saillie.create({
      data: {
        userId: session.user.id,
        date: data.date,
        femelleId: data.femelleId,
        maleId: data.maleId ?? null,
        type: data.type,
        agentInseminateur: data.agentInseminateur ?? null,
        semenceLot: data.semenceLot ?? null,
        pereExterneRef: data.pereExterneRef ?? null,
        confirmationGestation: data.confirmationGestation ?? null,
        campagneId: data.campagneId ?? null,
        dateMiseBasAttendue: dateMb,
        dateTarissementPrevue: dateTar,
        statut: data.confirmationGestation ? 'Gestante' : 'En attente',
        notes: data.notes ?? null,
      },
    })

    return NextResponse.json(
      {
        data: saillie,
        warnings:
          consanguinite.length > 0
            ? [
                {
                  code: 'CONSANGUINITE',
                  message: `Ancêtre(s) commun(s) détecté(s) sur 3 générations (animaux #${consanguinite.join(', #')}). Risque de consanguinité.`,
                  ancetresCommuns: consanguinite,
                },
              ]
            : [],
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('POST /api/elevage/saillies error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = updateSaillieSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, ...updates } = parsed.data

    const existing = await prisma.saillie.findFirst({
      where: { id, userId: session.user.id },
      include: { femelle: { include: { especeAnimale: true } }, miseBas: { select: { id: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Saillie non trouvée' }, { status: 404 })

    // Review caprin 2026-07-21 — garde d'intégrité du statut (symétrique du DELETE
    // qui refuse déjà si une mise-bas est liée) : ne pas laisser l'UI mettre un
    // statut incohérent avec une naissance réellement enregistrée.
    if (updates.statut && updates.statut !== existing.statut) {
      if (existing.miseBas && updates.statut !== 'Mise-bas réalisée') {
        return NextResponse.json(
          { error: 'Une mise-bas est enregistrée pour cette saillie : supprimez d\'abord la naissance pour changer le statut.' },
          { status: 409 }
        )
      }
      if (updates.statut === 'Mise-bas réalisée' && !existing.miseBas) {
        return NextResponse.json(
          { error: 'Enregistrez la mise-bas (onglet Reproduction → naissance) plutôt que de forcer ce statut.' },
          { status: 400 }
        )
      }
    }

    const data: any = { ...updates }
    if (updates.confirmationGestation && existing.statut === 'En attente') {
      data.statut = 'Gestante'
    }
    // POSTREVIEW Sprint 5 — Si la date change, recalculer dateMiseBasAttendue
    // et dateTarissementPrevue (avant : impossible de corriger une date saisie
    // par erreur sans DELETE+POST)
    if (updates.date) {
      const espece = existing.femelle.especeAnimale
      const duree = espece.dureeGestation ??
        DUREE_GESTATION_DEFAUTS[espece.id.toLowerCase()] ??
        DUREE_GESTATION_DEFAUTS[(espece.type || '').toLowerCase()]
      if (duree) {
        const dateMb = dateMiseBasAttendue(updates.date, duree)
        data.dateMiseBasAttendue = dateMb
        data.dateTarissementPrevue = dateTarissementPrevue(dateMb, espece.production)
      }
    }
    const saillie = await prisma.saillie.update({ where: { id }, data })
    return NextResponse.json({ data: saillie })
  } catch (err) {
    console.error('PATCH /api/elevage/saillies error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const existing = await prisma.saillie.findFirst({
    where: { id, userId: session.user.id },
    include: { miseBas: { select: { id: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Saillie non trouvée' }, { status: 404 })

  if (existing.miseBas) {
    return NextResponse.json(
      { error: 'Cette saillie est liée à une mise-bas enregistrée. Supprimez d\'abord la naissance.' },
      { status: 409 }
    )
  }

  await prisma.saillie.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
