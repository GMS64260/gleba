/**
 * API Collectes de lait (PROMPT 17).
 *
 * GET    ?from=YYYY-MM-DD&to=YYYY-MM-DD&animalId=&lotId=
 *        → liste, agrégée par jour×traite si besoin
 * POST   crée une collecte (animal OU lot)
 * PATCH  modifie une collecte
 * DELETE id=
 *
 * Contrainte d'unicité : (user, date, traite, animal, lot) — saisir 2 fois
 * la traite du matin d'un même animal écrase la première en upsert.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { collecteLaitSchema, updateCollecteLaitSchema } from '@/lib/validations/lait'
import { causesAttenteCollectes, soinCouvrantCollecte } from '@/lib/elevage/attente-lait'
import { reconstituerEffectifsLots } from '@/lib/elevage/effectif'
import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
import { ErreurElevage } from '@/lib/elevage/erreurs'
import { protegerCollecteAffectee } from '@/lib/elevage/collecte-affectee'
import {
  estAnimalCollectableLait,
  estLotCollectableLait,
  plafondCollecteLait,
} from '@/lib/elevage/cibles-collecte-lait'

/**
 * Refus d'un lot de fromage qui n'appartient pas au compte, sinon `null`.
 * POST et PATCH écrivaient `lotFromageId` sans rien vérifier : la collecte se
 * rattachait au lot de fabrication d'un autre compte (audit 2026-10-19). Même
 * refus que la vente de fromage (`ventes/route.ts`), qui nomme son champ.
 */
async function refusLotFromageHorsCompte(lotFromageId: string, userId: string): Promise<NextResponse | null> {
  const lot = await prisma.lotFromage.findFirst({
    where: { id: lotFromageId, userId },
    select: { id: true },
  })
  if (lot) return null
  return NextResponse.json(
    { error: 'Lot de fromage introuvable dans votre cave.', champ: 'lotFromageId' },
    { status: 400 }
  )
}

/**
 * Jour d'une traite (00:00 UTC) et plage qui le couvre.
 *
 * ELEV-01 (revue Codex du 2026-11-12) : le POST ramenait la date au jour, le
 * PATCH écrivait l'horodatage reçu ; une collecte redatée à midi échappait à
 * la recherche du POST (égalité à minuit) et la saisie suivante créait un
 * doublon. Toute écriture passe par `jourTraite`, et toute recherche « même
 * jour » par la plage, qui retrouve aussi les collectes déjà enregistrées avec
 * une heure.
 */
function jourTraite(date: Date | string): Date {
  const jour = new Date(date)
  jour.setUTCHours(0, 0, 0, 0)
  return jour
}

function plageJour(jour: Date): { gte: Date; lt: Date } {
  return { gte: jour, lt: new Date(jour.getTime() + 24 * 60 * 60 * 1000) }
}

type CibleCollecte = {
  type: 'animal' | 'lot'
  nomEspece: string | null
  effectif: number
  collectable: boolean
}

/**
 * Cible d'une traite (animal ou lot du compte) avec ce qu'il faut pour son
 * plafond indicatif ; `null` si elle n'existe pas dans le compte.
 */
async function chargerCibleCollecte(
  userId: string,
  animalId: number | null | undefined,
  lotId: number | null | undefined,
): Promise<CibleCollecte | null> {
  if (animalId) {
    const a = await prisma.animal.findFirst({
      where: { id: animalId, userId },
      select: {
        id: true,
        sexe: true,
        orientationProduction: true,
        especeAnimale: {
          select: { nom: true, type: true, production: true, productions: true },
        },
      },
    })
    if (!a) return null
    return { type: 'animal', nomEspece: a.especeAnimale.nom, effectif: 1, collectable: estAnimalCollectableLait(a) }
  }
  if (lotId) {
    const l = await prisma.lotAnimaux.findFirst({
      where: { id: lotId, userId },
      select: {
        id: true,
        quantiteInitiale: true,
        quantiteActuelle: true,
        especeAnimale: {
          select: { nom: true, type: true, production: true, productions: true },
        },
      },
    })
    if (!l) return null
    // Revue 2026-10-20 — plafond sur l'effectif reconstitué (celui de
    // l'écran Lots), pas sur le compteur stocké qui dérive.
    const effectifs = await reconstituerEffectifsLots(userId, [l])
    return {
      type: 'lot',
      nomEspece: l.especeAnimale.nom,
      effectif: Math.max(1, effectifs.get(l.id)?.effectifCalcule ?? l.quantiteActuelle),
      collectable: estLotCollectableLait(l),
    }
  }
  return null
}

/** Refus d'un volume au-dessus du plafond indicatif non confirmé, sinon `null`. */
function refusVolumeInhabituel(cible: CibleCollecte, quantite: number, confirme: boolean): NextResponse | null {
  const plafond = plafondCollecteLait(cible.nomEspece, cible.type, cible.effectif)
  if (quantite <= plafond || confirme) return null
  return NextResponse.json(
    {
      error: `Volume inhabituel : ${quantite} L dépasse le plafond indicatif de ${plafond} L pour cette traite. Confirmez explicitement pour l’enregistrer.`,
      code: 'VOLUME_LAIT_INHABITUEL',
      details: { plafond, quantite, espece: cible.nomEspece },
    },
    { status: 422 },
  )
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const animalId = searchParams.get('animalId')
  const lotId = searchParams.get('lotId')
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '', 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 1000) : undefined

  const where: Prisma.CollecteLaitWhereInput = { userId: session.user.id }
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    // Une borne « to » donnée en jour (YYYY-MM-DD) couvre le jour entier :
    // sans cela, `lte` s'arrêtait à minuit et excluait les collectes datées
    // dans la journée.
    if (to) where.date.lte = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999Z`) : new Date(to)
  }
  if (animalId) where.animalId = parseInt(animalId, 10)
  if (lotId) where.lotId = parseInt(lotId, 10)

  const collectes = await prisma.collecteLait.findMany({
    where,
    orderBy: [{ date: 'desc' }, { traite: 'asc' }],
    take: limit,
    include: {
      animal: { select: { id: true, identifiant: true, nom: true } },
      lot: { select: { id: true, nom: true } },
      lotFromage: { select: { id: true, numeroLot: true, typeFromage: true } },
    },
  })
  const causes = await causesAttenteCollectes(
    prisma,
    session.user.id,
    collectes.map((collecte) => ({
      id: collecte.id,
      date: collecte.date,
      animalId: collecte.animalId,
      lotId: collecte.lotId,
      ecarteAttente: collecte.ecarteAttente,
    }))
  )
  const data = collectes.map((collecte) => ({
    ...collecte,
    causeAttente: causes.get(collecte.id) ?? null,
  }))

  // Agrégats utiles
  const stats = {
    nbCollectes: collectes.length,
    totalLitres: collectes.reduce((s, c) => s + Number(c.quantiteLitres), 0),
    litresAffectes: collectes.filter((c) => c.lotFromageId).reduce((s, c) => s + Number(c.quantiteLitres), 0),
    litresEcartes: collectes.filter((c) => c.ecarteAttente).reduce((s, c) => s + Number(c.quantiteLitres), 0),
  }

  return NextResponse.json({ data, stats })
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = collecteLaitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    // Audit élevage 2026-06-11 — validation tenant : l'animal/le lot
    // référencé doit appartenir au user (même règle que mouvements-cheptel).
    const cible = await chargerCibleCollecte(session.user.id, data.animalId, data.lotId)
    if (!cible) {
      return NextResponse.json({ error: data.animalId ? 'Animal introuvable' : 'Lot introuvable' }, { status: 404 })
    }
    if (!cible.collectable) {
      return NextResponse.json(
        {
          error: cible.type === 'animal'
            ? 'La collecte de lait est réservée aux femelles d’un atelier laitier ou mixte.'
            : 'La collecte de lait est réservée aux lots d’un atelier laitier ou mixte.',
        },
        { status: 422 },
      )
    }
    const refusVolume = refusVolumeInhabituel(cible, data.quantiteLitres, data.confirmerVolumeInhabituel)
    if (refusVolume) return refusVolume

    // Normalise la date au jour (00:00 UTC)
    const day = jourTraite(data.date)
    // Écartement automatique CROSS-GRANULARITÉ (review caprin 2026-07-22) :
    // une collecte saisie dans la fenêtre d'attente d'un soin est écartée, que
    // le soin porte sur le MÊME animal/lot OU sur l'animal↔son lot (soin de lot
    // → collecte individuelle d'un membre, et inversement). Comparaison au jour
    // (collecte à 00:00, soin horodaté). Cf. lib attente-lait.
    if (data.lotFromageId) {
      const refusLot = await refusLotFromageHorsCompte(data.lotFromageId, session.user.id)
      if (refusLot) return refusLot
    }

    const { collecte, soinCouvrant, existant } = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session.user.id)
      // Même verrou que la fabrication : son affectation ne peut pas apparaître
      // entre le contrôle d'une correction et son écriture.
      const soinCouvrant = await soinCouvrantCollecte(tx, session.user.id, data.animalId ?? null, data.lotId ?? null, day)
      const existing = await tx.collecteLait.findFirst({
        where: {
          userId: session.user.id,
          date: plageJour(day),
          traite: data.traite,
          animalId: data.animalId ?? null,
          lotId: data.lotId ?? null,
        },
      })
      if (existing) protegerCollecteAffectee(existing, { ...data, date: day })
      const ecarte = soinCouvrant !== null || (body.ecarteAttente !== undefined ? data.ecarteAttente : existing?.ecarteAttente ?? false)

      const payload = {
        userId: session.user.id,
        date: day,
        traite: data.traite,
        animalId: data.animalId ?? null,
        lotId: data.lotId ?? null,
        quantiteLitres: data.quantiteLitres,
        mgGpl: data.mgGpl,
        mpGpl: data.mpGpl,
        cellulesParMl: data.cellulesParMl,
        temperatureC: data.temperatureC,
        ecarteAttente: ecarte,
        notes: data.notes,
        lotFromageId: data.lotFromageId,
      }

      const collecte = existing
        ? await tx.collecteLait.update({ where: { id: existing.id }, data: payload })
        : await tx.collecteLait.create({ data: payload })
      return { collecte, soinCouvrant, existant: Boolean(existing) }
    })

    return NextResponse.json(
      {
        data: collecte,
        info: soinCouvrant && !data.ecarteAttente
          ? `Collecte écartée automatiquement : traitement « ${soinCouvrant.produit || soinCouvrant.type} » en temps d'attente lait jusqu'au ${soinCouvrant.finAttenteLait?.toLocaleDateString('fr-FR')}.`
          : null,
      },
      { status: existant ? 200 : 201 }
    )
  } catch (err) {
    if (err instanceof ErreurElevage) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    console.error('POST /api/elevage/collectes-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = updateCollecteLaitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, confirmerVolumeInhabituel, ...updates } = parsed.data
    if (updates.lotFromageId) {
      const refusLot = await refusLotFromageHorsCompte(updates.lotFromageId, session.user.id)
      if (refusLot) return refusLot
    }

    // Revue du 2026-11-01 — une correction de volume passe par le même plafond
    // indicatif que la saisie, au lieu de la seule borne fixe de 100 L.
    if (updates.quantiteLitres !== undefined) {
      const actuelle = await prisma.collecteLait.findFirst({
        where: { id, userId: session.user.id },
        select: { quantiteLitres: true, animalId: true, lotId: true },
      })
      if (actuelle && Number(actuelle.quantiteLitres) !== updates.quantiteLitres) {
        const cible = await chargerCibleCollecte(session.user.id, actuelle.animalId, actuelle.lotId)
        const refusVolume = cible && refusVolumeInhabituel(cible, updates.quantiteLitres, confirmerVolumeInhabituel)
        if (refusVolume) return refusVolume
      }
    }

    // Ticket cms1v9rj5 — règle métier : une collecte dont la date est couverte
    // par la fenêtre [début soin .. fin_attente_lait] d'un soin actif DOIT être
    // écartée. Tout PATCH sans consigne explicite ré-affirme donc la couverture
    // à la date effective (nouvelle ou existante), pas seulement quand la date
    // change. La ré-intégration (flag → false), elle, ne se fait que sur
    // changement de date (audit 2026-06-11 : déplacer une collecte hors fenêtre
    // gardait l'ancien flag) pour ne pas effacer un écartement manuel.
    const collecte = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, session.user.id)
      const existing = await tx.collecteLait.findFirst({ where: { id, userId: session.user.id } })
      if (!existing) throw new ErreurElevage('Collecte non trouvée', 404)
      protegerCollecteAffectee(existing, updates)
      // Une traite par jour et par cible : redater une collecte sur un jour qui
      // en porte déjà une créait un doublon (la saisie, elle, complète la
      // collecte existante). L'index unique de la base ne l'empêchait pas.
      const jour = updates.date !== undefined ? jourTraite(updates.date) : undefined
      if (jour) {
        const autre = await tx.collecteLait.findFirst({
          where: {
            userId: session.user.id, id: { not: id }, date: plageJour(jour), traite: existing.traite,
            animalId: existing.animalId, lotId: existing.lotId,
          },
          select: { id: true },
        })
        if (autre) throw new ErreurElevage('Une collecte existe déjà ce jour-là pour cette traite : modifiez-la plutôt que d’en créer une seconde.', 409, 'COLLECTE_DEJA_SAISIE')
      }
      const data: typeof updates & { ecarteAttente?: boolean } = { ...updates, ...(jour ? { date: jour } : {}) }
      if (existing.animalId || existing.lotId) {
        const day = jour ?? jourTraite(existing.date)
        // Cross-granularité + comparaison au jour (cf. lib attente-lait).
        const soinCouvrant = await soinCouvrantCollecte(tx, session.user.id, existing.animalId, existing.lotId, day)
        if (soinCouvrant) data.ecarteAttente = true
        else if (updates.date && updates.ecarteAttente === undefined) data.ecarteAttente = false
      }

      return tx.collecteLait.update({ where: { id }, data })
    })
    return NextResponse.json({ data: collecte })
  } catch (err) {
    if (err instanceof ErreurElevage) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    console.error('PATCH /api/elevage/collectes-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
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
      const existing = await tx.collecteLait.findFirst({ where: { id, userId: session.user.id } })
      if (!existing) throw new ErreurElevage('Collecte non trouvée', 404)
      if (existing.lotFromageId) throw new ErreurElevage('Cette collecte est affectée à une fabrication. Annulez cette fabrication avant de supprimer la collecte.')
      await tx.collecteLait.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof ErreurElevage) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('DELETE /api/elevage/collectes-lait error:', err)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
