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
import { Prisma } from '@prisma/client'
import { lotSchema } from '@/lib/validations/elevage-lot'
import { deleteAutoEntry, createDepenseFromLotAnimaux } from '@/lib/auto-compta'
import { isPlausibleAnimalDate } from '@/lib/validations/elevage-animal'
import { enregistrerChangementLot, isOwnedParcelle } from '@/lib/elevage/animal-lot'
import { reconstituerEffectifsLots } from '@/lib/elevage/effectif'
import { calculerTetesNonPondeuses, effectifPondeuses, estEspecePondeuse } from '@/lib/elevage/pondeuses'
import { createDepenseFromAchatAnimal } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'
import { especeAnimaleAccessible } from '@/lib/elevage/espece-accessible'
import { MOTIF_MISE_EN_PLACE_LOT, messageTracesRegistreLot } from '@/lib/elevage/traces-lot'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const especeAnimaleId = searchParams.get('especeAnimaleId')
    const statut = searchParams.get('statut')

    const where: Prisma.LotAnimauxWhereInput = { userId: session.user.id }
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
            dureeElevage: true,
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
    // QA cmv5jfsol — effectif pondeur (sans les jeunes nés dans le lot ni les
    // fiches mâles) pour la saisie de ponte ; null hors espèces pondeuses.
    const lotsPondeurs = lots.filter((l) => estEspecePondeuse(l.especeAnimale.production))
    const tetesNonPondeuses = await calculerTetesNonPondeuses(session.user.id, lotsPondeurs)
    const idsPondeurs = new Set(lotsPondeurs.map((l) => l.id))

    const enriched = lots.map(l => {
      const e = effectifs.get(l.id)
      return {
        ...l,
        effectifPondeuses: idsPondeurs.has(l.id)
          ? effectifPondeuses(e?.effectifCalcule ?? l.quantiteActuelle, tetesNonPondeuses.get(l.id))
          : null,
        naissancesVivantes: e?.naissancesVivantes ?? 0,
        abattagesTotal: e?.abattagesTotal ?? 0,
        // Effectif reconstitué pour corriger les compteurs historiques dérivés.
        effectifCalcule: e?.effectifCalcule ?? l.quantiteActuelle,
        // Revue 2026-10-20 — fiches actives rattachées et part collective
        // (têtes anonymes, plafond d'un abattage de lot) : l'écran les lit ici
        // au lieu de recalculer.
        nominatifsActifs: e?.nominatifsActifs ?? 0,
        effectifCollectif: e?.effectifCollectif ?? l.quantiteActuelle,
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

    // L'espèce doit exister ET être visible du compte (catalogue, communauté
    // ou fiche perso) : même règle que les animaux.
    if (!await especeAnimaleAccessible(session.user.id, especeAnimaleId)) {
      return NextResponse.json(
        { error: `Espèce animale "${especeAnimaleId}" introuvable`, champ: 'especeAnimaleId' },
        { status: 400 }
      )
    }
    // La parcelle aussi, comme au PATCH : le POST l'écrivait sans contrôle.
    if (parcelleGeoId && !await isOwnedParcelle(session.user.id, parcelleGeoId)) {
      return NextResponse.json({ error: 'Parcelle invalide', champ: 'parcelleGeoId' }, { status: 400 })
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
            motif: MOTIF_MISE_EN_PLACE_LOT,
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
    const { id, nom, especeAnimaleId, dateArrivee, quantiteInitiale, quantiteActuelle, statut, dateReforme, provenance, prixAchatTotal, notes, parcelleGeoId, nExploitationDestination } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.lotAnimaux.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })
    }

    // Les quantités sont relues pour la garde de clôture : des nombres, pas des
    // opérations Prisma (`increment`…).
    const updateData: Prisma.LotAnimauxUncheckedUpdateInput & {
      quantiteInitiale?: number
      quantiteActuelle?: number
    } = {}
    // Revue élevage 2026-07-21 — le PATCH n'appliquait qu'un sous-ensemble de
    // champs : nom / espèce / dateArrivée / quantité initiale / provenance /
    // prixAchatTotal étaient ignorés en silence (200 trompeur), et la dépense
    // d'achat auto n'était jamais resynchronisée. On applique tout + resync.
    if (nom !== undefined) updateData.nom = nom || null
    if (especeAnimaleId !== undefined && especeAnimaleId) {
      if (
        especeAnimaleId !== existing.especeAnimaleId &&
        (typeof especeAnimaleId !== 'string' || !await especeAnimaleAccessible(session.user.id, especeAnimaleId))
      ) {
        return NextResponse.json(
          { error: `Espèce animale "${especeAnimaleId}" introuvable`, champ: 'especeAnimaleId' },
          { status: 400 }
        )
      }
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
    // Signalement 2026-09-25 — n° de l'exploitation ou de l'établissement qui
    // reçoit les têtes à la sortie du lot (exigé par la déclaration de sortie).
    if (nExploitationDestination !== undefined) {
      updateData.nExploitationDestination =
        typeof nExploitationDestination === 'string' ? nExploitationDestination.trim() || null : null
    }
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
            productionsRuche: true,
            collectesLait: true,
            soins: true,
            consommations: true,
            naissances: true,
            statutsSanitairesStructures: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lot non trouvé' }, { status: 404 })
    }

    // Empêcher la suppression si le lot a des dépendances actives.
    //
    // Signalement 2026-09-25 : un lot terminé dont les 12 animaux étaient tous
    // vendus ou abattus restait insupprimable (« lié à 12 animaux »), sans
    // piste pour s'en sortir. Les animaux SORTIS ne bloquent plus : ils gardent
    // leur fiche et leur historique, seul le rattachement au lot disparaît.
    // Les animaux présents, eux, se retirent d'abord du lot.
    //
    // 2026-10-23 (motif « suppressions », ouvert depuis le 2026-10-08) : la
    // garde des soins, naissances et consommations ne valait que pour un lot
    // qui avait eu des fiches nominatives. Un lot collectif (volailles, cas
    // courant) se supprimait en EFFAÇANT ses soins et consommations, en
    // détruisant en cascade ses mouvements de pâturage et statuts sanitaires,
    // et en détachant ses collectes de lait et productions de ruche : le
    // registre d'élevage perdait l'historique. Même règle que l'animal
    // (`compterTracesAnimal`) : un lot se supprime seulement s'il ne porte
    // AUCUNE saisie ; un lot réel qui s'arrête se clôture. Ne compte pas le
    // mouvement « Mise en place du lot » que la création écrit d'elle-même.
    const deps = existing._count
    const lotIdNum = parseInt(id)
    const [animauxPresents, mouvementsTous, mouvementsAuto] = await Promise.all([
      deps.animaux > 0
        ? prisma.animal.count({ where: { userId: session.user.id, lotId: lotIdNum, statut: 'actif' } })
        : Promise.resolve(0),
      prisma.mouvementCheptel.count({ where: { userId: session.user.id, lotId: lotIdNum } }),
      prisma.mouvementCheptel.count({
        where: { userId: session.user.id, lotId: lotIdNum, motif: MOTIF_MISE_EN_PLACE_LOT },
      }),
    ])
    const animauxSortis = deps.animaux - animauxPresents
    const mouvements = Math.max(0, mouvementsTous - mouvementsAuto)
    if (animauxPresents > 0) {
      return NextResponse.json(
        {
          error: `Ce lot contient encore ${animauxPresents} animal(aux) présent(s) : retirez-les du lot (« Ajouter / retirer des animaux ») ou clôturez le lot.`,
          details: { ...deps, animauxPresents },
        },
        { status: 409 }
      )
    }
    const productions = deps.productionsOeufs + deps.productionsRuche + deps.collectesLait
    if (deps.abattages > 0 || productions > 0) {
      return NextResponse.json(
        {
          error: `Ce lot porte ${deps.abattages} abattage(s) et ${productions} production(s) : il reste au registre. Clôturez-le plutôt que de le supprimer.`,
          details: deps,
        },
        { status: 409 }
      )
    }
    const registre = messageTracesRegistreLot({ ...deps, mouvements })
    if (registre) {
      return NextResponse.json(
        {
          error: `Ce lot porte ${registre} : ils restent au registre d'élevage. Clôturez le lot plutôt que de le supprimer, ou supprimez d'abord ces saisies si elles sont des erreurs.`,
          details: { ...deps, mouvements },
        },
        { status: 409 }
      )
    }
    if (animauxSortis > 0 && Number(existing.prixAchatTotal || 0) > 0) {
      return NextResponse.json(
        {
          error: "Ce lot porte un prix d'achat : son écriture reste en comptabilité. Clôturez le lot plutôt que de le supprimer.",
          details: deps,
        },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      if (animauxSortis > 0) {
        const dateEffet = new Date()
        const sortis = await tx.animal.findMany({
          where: { userId: session.user.id, lotId: lotIdNum },
          select: { id: true },
        })
        await tx.animal.updateMany({
          where: { userId: session.user.id, lotId: lotIdNum },
          data: { lotId: null },
        })
        for (const animal of sortis) {
          await enregistrerChangementLot(tx, session.user.id, animal.id, lotIdNum, null, dateEffet, 'Suppression du lot')
        }
      }
      // Soins et consommations : la garde ci-dessus refuse tout lot qui en
      // porte. Plus de suppression en masse ici (2026-10-23) : une saisie
      // arrivée entre la garde et la transaction se détache (`SetNull`) au
      // lieu d'être effacée.
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
