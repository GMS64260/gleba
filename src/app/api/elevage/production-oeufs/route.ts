/**
 * API Production d'œufs
 * GET /api/elevage/production-oeufs - Liste des productions
 * POST /api/elevage/production-oeufs - Enregistrer une production
 * PATCH /api/elevage/production-oeufs - Modifier une production
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { productionOeufsSchema } from '@/lib/validations/elevage-production-oeufs'
import { seuilCollecteMaxJour } from '@/lib/elevage/taux-ponte'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const lotId = searchParams.get('lotId')
    const animalId = searchParams.get('animalId')
    const dateDebut = searchParams.get('dateDebut')
    const dateFin = searchParams.get('dateFin')
    const limit = parseInt(searchParams.get('limit') || '100')
    const annee = parseInt(searchParams.get('annee') || String(new Date().getFullYear()))
    const yearStart = new Date(annee, 0, 1)
    const yearEnd = new Date(annee, 11, 31, 23, 59, 59)

    const where: any = { userId: session.user.id, date: { gte: yearStart, lte: yearEnd } }
    if (lotId) where.lotId = parseInt(lotId)
    if (animalId) where.animalId = parseInt(animalId)
    if (dateDebut || dateFin) {
      if (dateDebut) where.date.gte = new Date(dateDebut)
      if (dateFin) where.date.lte = new Date(dateFin)
    }

    const productions = await prisma.productionOeuf.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        lot: {
          select: { id: true, nom: true },
        },
        animal: {
          select: { id: true, nom: true, identifiant: true },
        },
      },
    })

    // Stats agrégées
    const stats = await prisma.productionOeuf.aggregate({
      where,
      _sum: {
        quantite: true,
        casses: true,
        sales: true,
      },
      _count: true,
    })

    return NextResponse.json({
      data: productions,
      stats: {
        total: stats._sum.quantite || 0,
        casses: stats._sum.casses || 0,
        sales: stats._sum.sales || 0,
        nbEnregistrements: stats._count,
      },
      meta: { year: annee, total: productions.length },
    })
  } catch (error) {
    console.error('GET /api/elevage/production-oeufs error:', error)
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
    const body = await request.json()
    const parsed = productionOeufsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { lotId, animalId, date, quantite, casses, sales, calibre, notes, overrideCoherence } = parsed.data

    // Audit élevage 2026-06-11 — validation tenant : l'animal référencé doit
    // appartenir au user (le lot l'est déjà plus bas).
    if (animalId) {
      const a = await prisma.animal.findFirst({
        where: { id: animalId, userId: session.user.id },
        select: { id: true },
      })
      if (!a) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
    }

    // BUG #2 (audit Julien 15/05/2026) — Validation de cohérence sur
    // l'effectif. Avant : 999 œufs pour 29 pondeuses passait silencieusement.
    // Désormais : refus 422 si quantite > effectif × marge_espèce, sauf
    // si l'éleveur a explicitement coché `overrideCoherence`.
    if (lotId) {
      const lot = await prisma.lotAnimaux.findFirst({
        where: { id: lotId, userId: session.user.id },
        select: {
          quantiteActuelle: true,
          statut: true,
          nom: true,
          especeAnimale: { select: { nom: true } },
        },
      })
      if (!lot) {
        return NextResponse.json(
          { error: 'Lot introuvable' },
          { status: 404 }
        )
      }
      // Feedback Marc 2026-05-16 — V3 Bug 3 : un lot dont le statut
      // est `termine` ou `reforme` ne doit plus accepter de saisies
      // de production (pondeuses 2026 « termine » continuait à recevoir
      // 75 œufs/jour). Bypass possible via `overrideCoherence` pour
      // corriger un statut erroné.
      if (!overrideCoherence && (lot.statut === 'termine' || lot.statut === 'reforme')) {
        return NextResponse.json(
          {
            error: 'Lot clôturé',
            code: 'LOT_TERMINE',
            details: {
              lotNom: lot.nom,
              statut: lot.statut,
              message: `Le lot « ${lot.nom} » est ${lot.statut}. Réactivez-le (statut « actif ») avant d'enregistrer une nouvelle collecte, ou cochez l'override pour forcer la saisie.`,
            },
          },
          { status: 422 }
        )
      }
      if (!overrideCoherence && lot.quantiteActuelle > 0) {
        const seuil = seuilCollecteMaxJour(lot.quantiteActuelle, lot.especeAnimale?.nom ?? null)
        if (seuil != null && quantite > seuil) {
          return NextResponse.json(
            {
              error: 'Saisie incohérente',
              code: 'COLLECTE_OVER_SEUIL',
              details: {
                quantite,
                seuilMax: seuil,
                effectif: lot.quantiteActuelle,
                espece: lot.especeAnimale?.nom ?? null,
                lotNom: lot.nom,
                message: `${lot.quantiteActuelle} ${lot.especeAnimale?.nom ?? 'pondeuse(s)'} ne peuvent pas pondre ${quantite} œufs en 1 jour (plafond plausible ≈ ${seuil}). Confirmer pour forcer la saisie.`,
              },
            },
            { status: 422 }
          )
        }
      }

      // Bug feedback testeur 2026-05-26 (cmpm75c6r) — Garde-fou doublon :
      // 2 saisies sur la même date+lot dans la même journée est
      // probablement une double saisie accidentelle (ou 2 passages au
      // poulailler dans la même journée). On bloque la 2e avec un code
      // distinct ; l'éleveur peut confirmer pour additionner.
      if (date && !animalId) {
        const dateOnly = new Date(date)
        dateOnly.setHours(0, 0, 0, 0)
        const dateNext = new Date(dateOnly)
        dateNext.setDate(dateNext.getDate() + 1)
        const existant = await prisma.productionOeuf.findFirst({
          where: {
            userId: session.user.id,
            lotId,
            date: { gte: dateOnly, lt: dateNext },
          },
          select: { id: true, quantite: true },
        })
        if (existant) {
          return NextResponse.json(
            {
              error: 'Collecte déjà saisie',
              code: 'DOUBLON_DATE_LOT',
              details: {
                idExistant: existant.id,
                quantiteExistante: existant.quantite,
                dateLue: dateOnly.toLocaleDateString('fr-FR'),
                message: `Une collecte de ${existant.quantite} œufs existe déjà sur ce lot pour le ${dateOnly.toLocaleDateString('fr-FR')}. Confirmer pour ajouter une 2e ligne (ex. 2 passages dans la journée), sinon modifiez la ligne existante.`,
              },
            },
            { status: 422 }
          )
        }
      }
    }

    const production = await prisma.productionOeuf.create({
      data: {
        userId: session.user.id,
        lotId: lotId || null,
        animalId: animalId || null,
        date: date || new Date(),
        quantite,
        casses,
        sales,
        calibre,
        notes,
      },
      include: {
        lot: true,
        animal: true,
      },
    })

    return NextResponse.json({ data: production }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/production-oeufs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const { id, date, quantite, casses, sales, calibre, notes, lotId, animalId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.productionOeuf.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Production non trouvée' }, { status: 404 })
    }

    const updateData: any = {}
    if (date !== undefined) updateData.date = new Date(date)
    // Audit élevage 2026-06-11 — garde NaN : parseInt("abc") partait en
    // erreur Prisma 500 illisible ; on renvoie un 400 explicite.
    if (quantite !== undefined) {
      const q = parseInt(quantite)
      if (Number.isNaN(q) || q < 0) return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })
      updateData.quantite = q
    }
    if (casses !== undefined) {
      const c = parseInt(casses)
      if (Number.isNaN(c) || c < 0) return NextResponse.json({ error: 'Nombre de cassés invalide' }, { status: 400 })
      updateData.casses = c
    }
    if (sales !== undefined) {
      const s = parseInt(sales)
      if (Number.isNaN(s) || s < 0) return NextResponse.json({ error: 'Nombre de sales invalide' }, { status: 400 })
      updateData.sales = s
    }
    if (calibre !== undefined) updateData.calibre = calibre
    if (notes !== undefined) updateData.notes = notes
    if (lotId !== undefined) updateData.lotId = lotId ? parseInt(lotId) : null
    if (animalId !== undefined) updateData.animalId = animalId ? parseInt(animalId) : null

    // Validation tenant des cibles modifiées.
    if (updateData.lotId) {
      const l = await prisma.lotAnimaux.findFirst({
        where: { id: updateData.lotId, userId: session.user.id },
        select: { id: true },
      })
      if (!l) return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }
    if (updateData.animalId) {
      const a = await prisma.animal.findFirst({
        where: { id: updateData.animalId, userId: session.user.id },
        select: { id: true },
      })
      if (!a) return NextResponse.json({ error: 'Animal introuvable' }, { status: 404 })
    }

    const production = await prisma.productionOeuf.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        lot: { select: { id: true, nom: true } },
        animal: { select: { id: true, nom: true, identifiant: true } },
      },
    })

    return NextResponse.json({ data: production })
  } catch (error) {
    console.error('PATCH /api/elevage/production-oeufs error:', error)
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

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.productionOeuf.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Production non trouvée' }, { status: 404 })
    }

    await prisma.productionOeuf.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/production-oeufs error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
