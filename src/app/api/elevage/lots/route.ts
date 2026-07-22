/**
 * API Lots d'animaux
 * GET /api/elevage/lots - Liste des lots
 * POST /api/elevage/lots - Créer un lot
 * PATCH /api/elevage/lots - Modifier un lot
 * DELETE /api/elevage/lots - Supprimer un lot
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { lotSchema } from '@/lib/validations/elevage-lot'
import { deleteAutoEntry, createDepenseFromLotAnimaux } from '@/lib/auto-compta'
import { isPlausibleAnimalDate } from '@/lib/validations/elevage-animal'
import { isOwnedParcelle } from '@/lib/elevage/animal-lot'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const especeAnimaleId = searchParams.get('especeAnimaleId')
    const statut = searchParams.get('statut')

    const where: any = { userId: session.user.id }
    if (especeAnimaleId) where.especeAnimaleId = especeAnimaleId
    if (statut) where.statut = statut

    const lots = await prisma.lotAnimaux.findMany({
      where,
      orderBy: [{ statut: 'asc' }, { dateArrivee: 'desc' }],
      include: {
        especeAnimale: {
          select: { id: true, nom: true, type: true, couleur: true },
        },
        parcelleGeo: {
          select: { id: true, nom: true },
        },
        _count: {
          select: {
            animaux: true,
            productionsOeufs: true,
            soins: true,
          },
        },
      },
    })

    // Bug #18 — Pour chaque lot, comptabiliser les naissances rattachables
    // (mère dans le lot) pour signaler les écarts non documentés entre
    // `quantiteInitiale` et `quantiteActuelle`. Permet à l'UI d'afficher
    // un badge "Écart non traçable" si quantité a gonflé sans naissance
    // ni achat enregistrés.
    const lotIds = lots.map(l => l.id)
    const naissancesParLot = new Map<number, number>()
    const abattagesParLot = new Map<number, number>()
    if (lotIds.length > 0) {
      const meresInLots = await prisma.animal.findMany({
        where: { userId: session.user.id, lotId: { in: lotIds } },
        select: { id: true, lotId: true },
      })
      const lotByMereId = new Map(meresInLots.map(m => [m.id, m.lotId]))
      // Naissances rattachables au lot : soit directement (lotId), soit via
      // la mère présente dans le lot. On attribue chaque naissance à UN seul
      // lot (priorité au lotId explicite) pour éviter le double comptage.
      const naissances = await prisma.naissanceAnimale.findMany({
        where: {
          userId: session.user.id,
          OR: [
            { lotId: { in: lotIds } },
            { mereId: { in: meresInLots.map(m => m.id) } },
          ],
        },
        select: { mereId: true, lotId: true, nombreVivants: true },
      })
      for (const n of naissances) {
        const lotId = n.lotId ?? (n.mereId != null ? lotByMereId.get(n.mereId) ?? null : null)
        if (!lotId) continue
        naissancesParLot.set(lotId, (naissancesParLot.get(lotId) ?? 0) + n.nombreVivants)
      }
      // Bug feedback testeur 2026-05-26 (cmpmr3837, cmpm7cssg) — l'effectif
      // "Actuel" stocké (quantiteActuelle) dérivait des mouvements réels :
      // les 5 abattages du lot Lapins ne le décrémentaient pas (affiché 14
      // au lieu de 2). On calcule un effectif AUTORITAIRE reconstitué à
      // partir des mouvements traçables : initial + naissances − abattages.
      const abattages = await prisma.abattage.groupBy({
        by: ['lotId'],
        where: { userId: session.user.id, lotId: { in: lotIds }, annule: false },
        _sum: { quantite: true },
      })
      for (const a of abattages) {
        if (a.lotId == null) continue
        abattagesParLot.set(a.lotId, a._sum.quantite ?? 0)
      }
    }

    const enriched = lots.map(l => {
      const naissances = naissancesParLot.get(l.id) ?? 0
      const abattages = abattagesParLot.get(l.id) ?? 0
      // Plafond traçable : un lot ne peut pas dépasser
      // initial + naissances − abattages. Si le compteur stocké est
      // au-dessus (abattages non décrémentés → bug cmpmr3837), on le
      // ramène au plafond. S'il est en-dessous (mortalités/ventes
      // individuelles non tracées par lot), on conserve la valeur
      // stockée, plus basse donc plus prudente.
      const plafond = Math.max(0, l.quantiteInitiale + naissances - abattages)
      const effectifCalcule = Math.min(l.quantiteActuelle, plafond)
      return {
        ...l,
        naissancesVivantes: naissances,
        abattagesTotal: abattages,
        // Effectif reconstitué (source de vérité pour l'affichage).
        effectifCalcule,
      }
    })

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('GET /api/elevage/lots error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des lots', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = lotSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { especeAnimaleId, nom, dateArrivee, quantiteInitiale, provenance, prixAchatTotal, notes, parcelleGeoId } = parsed.data

    // Vérifier que l'espece animale existe
    const espece = await prisma.especeAnimale.findUnique({
      where: { id: especeAnimaleId },
    })
    if (!espece) {
      return NextResponse.json(
        { error: `Espèce animale "${especeAnimaleId}" introuvable` },
        { status: 400 }
      )
    }

    const lot = await prisma.lotAnimaux.create({
      data: {
        userId: session.user.id,
        especeAnimaleId,
        nom,
        dateArrivee: dateArrivee ?? new Date(),
        quantiteInitiale,
        quantiteActuelle: quantiteInitiale,
        provenance,
        prixAchatTotal,
        statut: 'actif',
        notes,
        parcelleGeoId: parcelleGeoId || null,
      },
      include: {
        especeAnimale: true,
      },
    })

    // Bug R28 : écriture comptable auto de l'achat du lot (KPI dépenses).
    await createDepenseFromLotAnimaux(session.user.id, lot)

    return NextResponse.json({ data: lot }, { status: 201 })
  } catch (error) {
    console.error('POST /api/elevage/lots error:', error)
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
    const { id, nom, especeAnimaleId, dateArrivee, quantiteInitiale, quantiteActuelle, statut, dateReforme, provenance, prixAchatTotal, notes, parcelleGeoId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.lotAnimaux.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })
    }

    const updateData: any = {}
    // Revue élevage 2026-07-21 — le PATCH n'appliquait qu'un sous-ensemble de
    // champs : nom / espèce / dateArrivée / quantité initiale / provenance /
    // prixAchatTotal étaient ignorés en silence (200 trompeur), et la dépense
    // d'achat auto n'était jamais resynchronisée. On applique tout + resync.
    if (nom !== undefined) updateData.nom = nom || null
    if (especeAnimaleId !== undefined && especeAnimaleId) {
      const espece = await prisma.especeAnimale.findUnique({ where: { id: especeAnimaleId } })
      if (!espece) return NextResponse.json({ error: `Espèce animale "${especeAnimaleId}" introuvable` }, { status: 400 })
      updateData.especeAnimaleId = especeAnimaleId
    }
    if (dateArrivee !== undefined) {
      if (!dateArrivee) updateData.dateArrivee = null
      else {
        const d = new Date(dateArrivee)
        if (!isPlausibleAnimalDate(d)) {
          return NextResponse.json({ error: `Date d'arrivée invalide (année attendue entre 1990 et ${new Date().getFullYear() + 1})` }, { status: 400 })
        }
        updateData.dateArrivee = d
      }
    }
    if (quantiteInitiale !== undefined) {
      const q = parseInt(quantiteInitiale)
      if (!Number.isNaN(q)) updateData.quantiteInitiale = q
    }
    if (quantiteActuelle !== undefined) {
      const q = parseInt(quantiteActuelle)
      if (!Number.isNaN(q)) updateData.quantiteActuelle = q
    }
    if (statut !== undefined) updateData.statut = statut
    if (dateReforme !== undefined) updateData.dateReforme = dateReforme ? new Date(dateReforme) : null
    if (provenance !== undefined) updateData.provenance = provenance || null
    if (prixAchatTotal !== undefined) {
      const p = prixAchatTotal === null || prixAchatTotal === '' ? null : Number(prixAchatTotal)
      updateData.prixAchatTotal = p === null || Number.isNaN(p) ? null : p
    }
    if (notes !== undefined) updateData.notes = notes
    if (
      parcelleGeoId !== undefined && parcelleGeoId !== null && parcelleGeoId !== '' &&
      parcelleGeoId !== existing.parcelleGeoId &&
      !await isOwnedParcelle(session.user.id, parcelleGeoId)
    ) return NextResponse.json({ error: 'Parcelle invalide' }, { status: 400 })
    if (parcelleGeoId !== undefined) updateData.parcelleGeoId = parcelleGeoId || null

    const lot = await prisma.$transaction(async (tx) => {
      const updated = await tx.lotAnimaux.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: { especeAnimale: true },
      })
      if (updateData.parcelleGeoId !== undefined && updated.parcelleGeoId !== existing.parcelleGeoId) {
        await tx.mouvementCheptel.create({
          data: {
            userId: session.user.id, lotId: existing.id,
            parcelleAvantId: existing.parcelleGeoId, parcelleApresId: updated.parcelleGeoId,
            date: new Date(), motif: 'Modification de la fiche lot',
          },
        })
      }
      return updated
    })

    // Resync de la dépense d'achat auto (prixAchatTotal/dateArrivée ont pu changer ;
    // le helper supprime l'écriture si le prix retombe à 0/null).
    try {
      await createDepenseFromLotAnimaux(session.user.id, lot)
    } catch (autoComptaError) {
      console.error('Auto-compta error (achat_animal lot PATCH):', autoComptaError)
    }

    return NextResponse.json({ data: lot })
  } catch (error) {
    console.error('PATCH /api/elevage/lots error:', error)
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

    const existing = await prisma.lotAnimaux.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
      include: {
        _count: {
          select: {
            animaux: true,
            abattages: true,
            productionsOeufs: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })
    }

    // Empêcher la suppression si le lot a des dépendances actives
    const deps = existing._count
    if (deps.animaux > 0 || deps.abattages > 0 || deps.productionsOeufs > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer ce lot : il est lié à ${deps.animaux} animaux, ${deps.abattages} abattages, ${deps.productionsOeufs} productions`,
          details: deps,
        },
        { status: 409 }
      )
    }

    // Nettoyer les écritures auto-compta liées aux consommations d'aliments du lot
    try {
      // Auto-compta : purger les écritures auto des consommations et soins du
      // lot AVANT leur suppression en masse (sinon les DepenseManuelle auto
      // resteraient orphelines).
      const [consosLot, soinsLot] = await Promise.all([
        prisma.consommationAliment.findMany({
          where: { lotId: parseInt(id), userId: session.user.id },
          select: { id: true },
        }),
        prisma.soinAnimal.findMany({
          where: { lotId: parseInt(id), userId: session.user.id },
          select: { id: true },
        }),
      ])
      if (consosLot.length > 0) {
        await prisma.depenseManuelle.deleteMany({
          where: { sourceType: 'consommation_aliment', sourceId: { in: consosLot.map((c) => c.id) }, auto: true },
        })
      }
      if (soinsLot.length > 0) {
        await prisma.depenseManuelle.deleteMany({
          where: { sourceType: 'soin_animal', sourceId: { in: soinsLot.map((s) => s.id) }, auto: true },
        })
      }

      await prisma.consommationAliment.deleteMany({
        where: { lotId: parseInt(id), userId: session.user.id },
      })
      await prisma.soinAnimal.deleteMany({
        where: { lotId: parseInt(id), userId: session.user.id },
      })
      // Bug R28 : supprimer l'écriture comptable auto de l'achat du lot.
      await deleteAutoEntry('achat_animal', parseInt(id), 'depense')
    } catch (cleanupError) {
      console.error('Cleanup error (lot DELETE):', cleanupError)
    }

    await prisma.lotAnimaux.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true, deleted: parseInt(id) })
  } catch (error) {
    console.error('DELETE /api/elevage/lots error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
