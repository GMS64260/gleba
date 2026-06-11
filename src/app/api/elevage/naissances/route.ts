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
          lot: { select: { id: true, nom: true, especeAnimale: { select: { nom: true } } } },
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

    // Audit élevage 2026-06-11 — validation tenant : la mère, le lot cible
    // et la saillie référencés doivent appartenir au user (avant : un POST
    // avec un lotId/saillieId arbitraire écrivait dans les données d'un
    // autre compte via tx.lotAnimaux.update / tx.saillie.update non scopés).
    if (parsed.data.mereId) {
      const mere = await prisma.animal.findFirst({
        where: { id: parsed.data.mereId, userId },
        select: { id: true },
      })
      if (!mere) return NextResponse.json({ error: 'Mère introuvable' }, { status: 404 })
    }
    if (parsed.data.lotId) {
      const lot = await prisma.lotAnimaux.findFirst({
        where: { id: parsed.data.lotId, userId },
        select: { id: true },
      })
      if (!lot) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }
    if (parsed.data.saillieId) {
      const saillie = await prisma.saillie.findFirst({
        where: { id: parsed.data.saillieId, userId },
        select: { id: true },
      })
      if (!saillie) return NextResponse.json({ error: 'Saillie introuvable' }, { status: 404 })
    }

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
          lotId: parsed.data.lotId ?? null,
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
      // Priorité au lot explicitement choisi (élevage en lot, cmpm79lql),
      // sinon au lot de la mère, sinon création d'un lot "Petits ...".
      const lotCible = parsed.data.lotId ?? created.mere?.lotId ?? null
      if (vivants > 0 && lotCible) {
        await tx.lotAnimaux.update({
          where: { id: lotCible },
          data: { quantiteActuelle: { increment: vivants } },
        })
      } else if (vivants > 0 && created.mere) {
        if (created.mere.especeAnimaleId) {
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
          // Audit élevage 2026-06-11 — relier la naissance au lot créé,
          // sinon le DELETE ne sait pas quel effectif décrémenter.
          await tx.naissanceAnimale.update({
            where: { id: created.id },
            data: { lotId: lot.id },
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
      include: { mere: { select: { lotId: true } } },
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

    // Audit élevage 2026-06-11 — validation tenant des références modifiées.
    let nouvelleMereLotId: number | null = null
    if (parsed.data.mereId) {
      const mere = await prisma.animal.findFirst({
        where: { id: parsed.data.mereId, userId },
        select: { id: true, lotId: true },
      })
      if (!mere) return NextResponse.json({ error: 'Mère introuvable' }, { status: 404 })
      nouvelleMereLotId = mere.lotId
    }
    if (parsed.data.lotId) {
      const lot = await prisma.lotAnimaux.findFirst({
        where: { id: parsed.data.lotId, userId },
        select: { id: true },
      })
      if (!lot) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }

    // Audit élevage 2026-06-11 — le POST crédite l'effectif du lot cible ;
    // l'édition doit suivre (avant : passer de 8 à 5 vivants ou changer de
    // lot laissait les compteurs de la création).
    const ancienLot = existing.lotId ?? existing.mere?.lotId ?? null
    const nouveauLot = parsed.data.lotId ?? nouvelleMereLotId ?? null
    const ancienVivants = existing.nombreVivants
    const nouveauVivants = parsed.data.nombreVivants

    const updated = await prisma.$transaction(async (tx) => {
      if (ancienLot !== nouveauLot || ancienVivants !== nouveauVivants) {
        if (ancienLot && ancienVivants > 0) {
          const lot = await tx.lotAnimaux.findFirst({
            where: { id: ancienLot, userId },
            select: { id: true, quantiteActuelle: true },
          })
          if (lot) {
            await tx.lotAnimaux.update({
              where: { id: lot.id },
              data: { quantiteActuelle: Math.max(0, lot.quantiteActuelle - ancienVivants) },
            })
          }
        }
        if (nouveauLot && nouveauVivants > 0) {
          await tx.lotAnimaux.updateMany({
            where: { id: nouveauLot, userId },
            data: { quantiteActuelle: { increment: nouveauVivants } },
          })
        }
      }

      return tx.naissanceAnimale.update({
        where: { id },
        data: {
          mereId: parsed.data.mereId ?? null,
          lotId: parsed.data.lotId ?? null,
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

    // Bug cmp8rub7p — décrémenter l'effectif du lot crédité à la création
    // (POST). Le seuil min 0 évite les compteurs négatifs si l'utilisateur
    // a ajusté manuellement entre temps.
    // Audit élevage 2026-06-11 — le POST crédite en priorité le lot
    // EXPLICITE (naissance.lotId), pas celui de la mère : le DELETE doit
    // décrémenter le même (avant : un lot explicite ≠ lot de la mère
    // laissait l'explicite gonflé et vidait celui de la mère à tort).
    const lotCredite = existing.lotId ?? existing.mere?.lotId ?? null
    await prisma.$transaction(async (tx) => {
      if (lotCredite && existing.nombreVivants > 0) {
        const lot = await tx.lotAnimaux.findFirst({
          where: { id: lotCredite, userId: session.user.id },
          select: { id: true, quantiteActuelle: true },
        })
        if (lot) {
          const next = Math.max(0, lot.quantiteActuelle - existing.nombreVivants)
          await tx.lotAnimaux.update({
            where: { id: lot.id },
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
