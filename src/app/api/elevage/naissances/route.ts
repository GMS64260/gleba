/**
 * API Naissances Animales - CRUD
 * GET /api/elevage/naissances - Liste des naissances
 * POST /api/elevage/naissances - Enregistrer une naissance
 * DELETE /api/elevage/naissances?id=X - Supprimer une naissance
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { naissanceSchema } from '@/lib/validations/elevage-naissance'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = searchParams.get('annee')
    const limit = parseInt(searchParams.get('limit') || '100')
    const userId = session.user.id

    const where: Record<string, unknown> = { userId }
    if (annee) {
      const start = new Date(parseInt(annee), 0, 1)
      const end = new Date(parseInt(annee), 11, 31, 23, 59, 59)
      where.date = { gte: start, lte: end }
    }

    const [naissances, stats] = await Promise.all([
      prisma.naissanceAnimale.findMany({
        where,
        include: {
          mere: {
            select: {
              id: true,
              nom: true,
              identifiant: true,
              race: true,
              especeAnimale: { select: { id: true, nom: true, dureeGestation: true, dureeCouvaison: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: limit,
      }),

      prisma.naissanceAnimale.aggregate({
        where,
        _sum: {
          nombreNes: true,
          nombreVivants: true,
          nombreMales: true,
          nombreFemelles: true,
        },
        _count: true,
      }),
    ])

    // Stats par mois
    const parMois: Record<number, { nes: number; vivants: number }> = {}
    naissances.forEach(n => {
      const mois = new Date(n.date).getMonth() + 1
      if (!parMois[mois]) parMois[mois] = { nes: 0, vivants: 0 }
      parMois[mois].nes += n.nombreNes
      parMois[mois].vivants += n.nombreVivants
    })

    return NextResponse.json({
      data: naissances,
      stats: {
        totalNaissances: stats._count,
        totalNes: stats._sum.nombreNes || 0,
        totalVivants: stats._sum.nombreVivants || 0,
        totalMales: stats._sum.nombreMales || 0,
        totalFemelles: stats._sum.nombreFemelles || 0,
        tauxSurvie: (stats._sum.nombreNes || 0) > 0
          ? Math.round(((stats._sum.nombreVivants || 0) / (stats._sum.nombreNes || 1)) * 1000) / 10
          : null,
        parMois: Array.from({ length: 12 }, (_, i) => ({
          mois: i + 1,
          nes: parMois[i + 1]?.nes || 0,
          vivants: parMois[i + 1]?.vivants || 0,
        })),
      },
    })
  } catch (error) {
    console.error('GET /api/elevage/naissances error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des naissances', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = naissanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const userId = session.user.id

    // PROMPT 18 — si saillieId fourni, on lie la mise-bas à la saillie et on
    // bascule la saillie en statut "Mise-bas réalisée" dans la même transaction.
    // Bug cmp8rub7p (Marc 2026-05-16) — les naissances n'étaient pas reportées
    // sur l'effectif. Désormais : si la mère est rattachée à un lot, on
    // incrémente le lot.quantiteActuelle du nombre de vivants ; sinon (et si
    // l'espèce de la mère est connue), on crée un lot "Petits <Espèce>
    // <année>" et on l'incrémente. Faute de fiche animale détaillée pour
    // chaque petit (sexe/identifiant), on tient au moins le compteur d'effectif.
    const naissance = await prisma.$transaction(async (tx) => {
      const created = await tx.naissanceAnimale.create({
        data: {
          userId,
          mereId: parsed.data.mereId ?? null,
          pereIdentifiant: parsed.data.pereIdentifiant ?? null,
          date: parsed.data.date ?? new Date(),
          nombreNes: parsed.data.nombreNes,
          nombreVivants: parsed.data.nombreVivants,
          nombreMales: parsed.data.nombreMales ?? null,
          nombreFemelles: parsed.data.nombreFemelles ?? null,
          poidsTotal: parsed.data.poidsTotal ?? null,
          notes: parsed.data.notes ?? null,
          saillieId: parsed.data.saillieId ?? null,
        },
        include: { mere: { select: { id: true, nom: true, identifiant: true, lotId: true, especeAnimaleId: true } } },
      })

      if (parsed.data.saillieId) {
        await tx.saillie.update({
          where: { id: parsed.data.saillieId },
          data: { statut: 'Mise-bas réalisée' },
        })
      }

      const vivants = parsed.data.nombreVivants
      if (vivants > 0 && created.mere) {
        if (created.mere.lotId) {
          await tx.lotAnimaux.update({
            where: { id: created.mere.lotId },
            data: { quantiteActuelle: { increment: vivants } },
          })
        } else if (created.mere.especeAnimaleId) {
          const annee = (parsed.data.date ?? new Date()).getFullYear()
          const espece = await tx.especeAnimale.findUnique({
            where: { id: created.mere.especeAnimaleId },
            select: { nom: true },
          })
          const nomLot = `Petits ${espece?.nom ?? 'animaux'} ${annee}`
          const lot = await tx.lotAnimaux.create({
            data: {
              userId,
              especeAnimaleId: created.mere.especeAnimaleId,
              nom: nomLot,
              dateArrivee: parsed.data.date ?? new Date(),
              quantiteInitiale: vivants,
              quantiteActuelle: vivants,
              provenance: 'Naissance interne',
              statut: 'actif',
            },
          })
          await tx.lotAnimaux.update({
            where: { id: lot.id },
            data: { quantiteActuelle: vivants, quantiteInitiale: vivants },
          })
        }
      }

      return created
    })

    return NextResponse.json({ data: naissance }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/naissances error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la creation', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

// QA 2026-05-15 — édition par ligne depuis l'onglet Naissances.
export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const id = parseInt(body.id, 10)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }
    const userId = session.user.id
    const existing = await prisma.naissanceAnimale.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Naissance introuvable' }, { status: 404 })
    }
    const parsed = naissanceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const updated = await prisma.naissanceAnimale.update({
      where: { id },
      data: {
        mereId: parsed.data.mereId ?? null,
        pereIdentifiant: parsed.data.pereIdentifiant ?? null,
        date: parsed.data.date ?? existing.date,
        nombreNes: parsed.data.nombreNes,
        nombreVivants: parsed.data.nombreVivants,
        nombreMales: parsed.data.nombreMales ?? null,
        nombreFemelles: parsed.data.nombreFemelles ?? null,
        poidsTotal: parsed.data.poidsTotal ?? null,
        notes: parsed.data.notes ?? null,
      },
      include: { mere: { select: { id: true, nom: true, identifiant: true } } },
    })
    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('PATCH /api/elevage/naissances error:', error)
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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

    const existing = await prisma.naissanceAnimale.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
      include: { mere: { select: { lotId: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Naissance non trouvee' }, { status: 404 })

    // Bug cmp8rub7p — décrémenter l'effectif du lot maternel si on avait
    // incrémenté à la création (POST). Le seuil min 0 évite les compteurs
    // négatifs si l'utilisateur a ajusté manuellement entre temps.
    await prisma.$transaction(async (tx) => {
      if (existing.mere?.lotId && existing.nombreVivants > 0) {
        const lot = await tx.lotAnimaux.findUnique({
          where: { id: existing.mere.lotId },
          select: { quantiteActuelle: true },
        })
        if (lot) {
          const next = Math.max(0, lot.quantiteActuelle - existing.nombreVivants)
          await tx.lotAnimaux.update({
            where: { id: existing.mere.lotId },
            data: { quantiteActuelle: next },
          })
        }
      }
      await tx.naissanceAnimale.delete({ where: { id: parseInt(id) } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/naissances error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
