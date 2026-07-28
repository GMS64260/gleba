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
import { reconstituerEffectifsLots } from '@/lib/elevage/effectif'
import { createDepenseFromAchatAnimal } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'

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
          select: {
            id: true,
            nom: true,
            type: true,
            filiere: true,
            production: true,
            productions: true,
            couleur: true,
          },
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

    // Bug #18 / bug cmpmr3837 — le compteur stocké `quantiteActuelle` dérive
    // (abattages/mortalités non décrémentés : lot Lapins affiché 14 au lieu de
    // 2). On reconstitue un effectif prudent (initial + naissances explicites −
    // abattages, plafonné par le compteur stocké) via le helper partagé avec
    // GET /stats, pour que les deux surfaces ne divergent plus.
    const effectifs = await reconstituerEffectifsLots(session.user.id, lots)

    const enriched = lots.map(l => {
      const e = effectifs.get(l.id)
      return {
        ...l,
        naissancesVivantes: e?.naissancesVivantes ?? 0,
        abattagesTotal: e?.abattagesTotal ?? 0,
        // Effectif reconstitué pour corriger les compteurs historiques dérivés.
        effectifCalcule: e?.effectifCalcule ?? l.quantiteActuelle,
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

    const lot = await prisma.$transaction(async (tx) => {
      const created = await tx.lotAnimaux.create({
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
        include: { especeAnimale: true },
      })
      // Ticket cms1v9ymn — un lot créé directement sur une parcelle n'avait
      // aucun MouvementCheptel d'entrée : le module pâturage affichait la
      // parcelle « Libre » faute de date d'entrée. On trace la mise en place
      // initiale (symétrique du mouvement créé par le PATCH au changement de
      // parcelle).
      if (created.parcelleGeoId) {
        await tx.mouvementCheptel.create({
          data: {
            userId: session.user.id,
            lotId: created.id,
            parcelleAvantId: null,
            parcelleApresId: created.parcelleGeoId,
            date: created.dateArrivee ?? new Date(),
            motif: 'Mise en place du lot',
          },
        })
      }
      await createDepenseFromLotAnimaux(session.user.id, created, tx)
      return created
    })
    invalidateKpi(session.user.id)

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
      if (Number.isNaN(q) || q < 0) {
        return NextResponse.json({ error: 'Quantité initiale invalide' }, { status: 400 })
      }
      updateData.quantiteInitiale = q
    }
    if (quantiteActuelle !== undefined) {
      const q = parseInt(quantiteActuelle)
      if (Number.isNaN(q) || q < 0) {
        return NextResponse.json({ error: 'Quantité actuelle invalide' }, { status: 400 })
      }
      updateData.quantiteActuelle = q
    }
    // Ticket cms1vdxcj — clôturer un lot (terminé/réformé) sans avoir tracé la
    // sortie des animaux (vente, abattage, mortalité, transfert) laisse un
    // registre incohérent : les têtes « disparaissent » sans mouvement. On
    // refuse (409) tant que l'effectif reconstitué est > 0. Le body peut
    // porter `forcerCloture: true` pour outrepasser explicitement (parcours
    // historiques / régularisation d'un lot dont les sorties ne seront jamais
    // saisies) — dans ce cas la clôture passe telle quelle.
    if (
      statut !== undefined &&
      (statut === 'termine' || statut === 'reforme') &&
      statut !== existing.statut &&
      body.forcerCloture !== true
    ) {
      const effectifs = await reconstituerEffectifsLots(session.user.id, [{
        id: existing.id,
        // Si le même PATCH remet les quantités à jour, on clôture sur ces
        // valeurs finales plutôt que sur l'état stocké.
        quantiteInitiale: updateData.quantiteInitiale ?? existing.quantiteInitiale,
        quantiteActuelle: updateData.quantiteActuelle ?? existing.quantiteActuelle,
      }])
      const effectifRestant = effectifs.get(existing.id)?.effectifCalcule ?? existing.quantiteActuelle
      if (effectifRestant > 0) {
        return NextResponse.json(
          {
            error: `Le lot compte encore ${effectifRestant} tête(s) : enregistrez d'abord leurs sorties (vente, abattage, mortalité ou transfert) pour un registre cohérent.`,
            code: 'LOT_NON_SOLDE',
            effectifRestant,
          },
          { status: 409 }
        )
      }
    }
    if (statut !== undefined) updateData.statut = statut
    if (dateReforme !== undefined) updateData.dateReforme = dateReforme ? new Date(dateReforme) : null
    if (provenance !== undefined) updateData.provenance = provenance || null
    if (prixAchatTotal !== undefined) {
      const p = prixAchatTotal === null || prixAchatTotal === '' ? null : Number(prixAchatTotal)
      if (p != null && (!Number.isFinite(p) || p < 0)) {
        return NextResponse.json({ error: "Prix d'achat total invalide" }, { status: 400 })
      }
      updateData.prixAchatTotal = p
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
      await createDepenseFromLotAnimaux(session.user.id, updated, tx)

      // Le prix du lot est la source comptable unique. Les prix individuels
      // restent des ventilations informatives et retrouvent leur miroir si le
      // prix total du lot est ensuite supprimé.
      if (updateData.prixAchatTotal !== undefined) {
        const animaux = await tx.animal.findMany({
          where: { userId: session.user.id, lotId: updated.id, prixAchat: { gt: 0 } },
        })
        const inclus = Number(updated.prixAchatTotal || 0) > 0
        if (animaux.length > 0) {
          await tx.animal.updateMany({
            where: { id: { in: animaux.map((a) => a.id) }, userId: session.user.id },
            data: { prixAchatInclusDansLot: inclus },
          })
          for (const animal of animaux) {
            await createDepenseFromAchatAnimal(session.user.id, {
              id: animal.id,
              nom: animal.nom,
              identifiant: animal.identifiant,
              prixAchat: animal.prixAchat,
              dateArrivee: animal.dateArrivee,
              prixAchatInclusDansLot: inclus,
            }, tx)
          }
        }
      }
      return updated
    })
    invalidateKpi(session.user.id)

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

    await prisma.$transaction(async (tx) => {
      // Auto-compta : purger les écritures auto des consommations et soins du
      // lot AVANT leur suppression en masse (sinon les DepenseManuelle auto
      // resteraient orphelines).
      const [consosLot, soinsLot] = await Promise.all([
        tx.consommationAliment.findMany({
          where: { lotId: parseInt(id), userId: session.user.id },
          select: { id: true },
        }),
        tx.soinAnimal.findMany({
          where: { lotId: parseInt(id), userId: session.user.id },
          select: { id: true },
        }),
      ])
      if (consosLot.length > 0) {
        await tx.depenseManuelle.deleteMany({
          where: { userId: session.user.id, sourceType: 'consommation_aliment', sourceId: { in: consosLot.map((c) => c.id) }, auto: true },
        })
      }
      if (soinsLot.length > 0) {
        await tx.depenseManuelle.deleteMany({
          where: { userId: session.user.id, sourceType: 'soin_animal', sourceId: { in: soinsLot.map((s) => s.id) }, auto: true },
        })
      }

      await tx.consommationAliment.deleteMany({
        where: { lotId: parseInt(id), userId: session.user.id },
      })
      await tx.soinAnimal.deleteMany({
        where: { lotId: parseInt(id), userId: session.user.id },
      })
      // Bug R28 : supprimer l'écriture comptable auto de l'achat du lot.
      await deleteAutoEntry('achat_animal', existing.id, 'depense', session.user.id, tx)
      await tx.lotAnimaux.delete({ where: { id: existing.id } })
    })
    invalidateKpi(session.user.id)

    return NextResponse.json({ success: true, deleted: parseInt(id) })
  } catch (error) {
    console.error('DELETE /api/elevage/lots error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
