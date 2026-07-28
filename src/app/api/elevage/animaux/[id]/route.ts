/**
 * API Animal individuel
 * GET /api/elevage/animaux/[id] - Détails d'un animal
 * PUT /api/elevage/animaux/[id] - Modifier un animal
 * DELETE /api/elevage/animaux/[id] - Supprimer un animal
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createDepenseFromAchatAnimal, deleteAutoEntry } from '@/lib/auto-compta'
import { isPlausibleAnimalDate } from '@/lib/validations/elevage-animal'
import { enregistrerChangementLot, isAssignableAnimalLot, isOwnedParcelle } from '@/lib/elevage/animal-lot'
import { verifierLienParenteSansCycle } from '@/lib/elevage/genealogie-validation'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { invalidateKpi } from '@/lib/kpi'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const animal = await prisma.animal.findFirst({
      where: {
        id: parseInt(id),
        userId: session.user.id,
      },
      include: {
        especeAnimale: true,
        lot: true,
        mere: {
          select: { id: true, nom: true, identifiant: true, sexe: true, especeAnimaleId: true,
            mere: { select: { id: true, nom: true, identifiant: true, sexe: true } },
            pere: { select: { id: true, nom: true, identifiant: true, sexe: true } },
          },
        },
        pere: {
          select: {
            id: true,
            nom: true,
            identifiant: true,
            sexe: true,
            especeAnimaleId: true,
            mere: { select: { id: true, nom: true, identifiant: true, sexe: true } },
            pere: { select: { id: true, nom: true, identifiant: true, sexe: true } },
          },
        },
        enfants: {
          select: { id: true, nom: true, identifiant: true, sexe: true, dateNaissance: true, statut: true },
        },
        naissancesMere: {
          orderBy: { date: 'desc' },
          take: 50,
        },
        // QA caprin cms1vhs9l — la fiche doit restituer la reproduction :
        // gestation en cours, mise-bas prévue, tarissement, historique.
        sailliesFemelle: {
          orderBy: { date: 'desc' },
          take: 30,
          select: {
            id: true,
            date: true,
            type: true,
            statut: true,
            dateMiseBasAttendue: true,
            dateTarissementPrevue: true,
            male: { select: { id: true, nom: true, identifiant: true } },
            pereExterneRef: true,
          },
        },
        productionsOeufs: {
          orderBy: { date: 'desc' },
          take: 20,
        },
        soins: {
          orderBy: { date: 'desc' },
          take: 20,
        },
        abattages: true,
      },
    })

    if (!animal) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ data: animal })
  } catch (error) {
    console.error('GET /api/elevage/animaux/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.animal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (body.statut !== undefined) data.statut = body.statut
    if (body.dateSortie !== undefined) data.dateSortie = new Date(body.dateSortie)
    if (body.causeSortie !== undefined) data.causeSortie = body.causeSortie
    if (body.poidsActuel !== undefined) data.poidsActuel = body.poidsActuel
    // PROMPT 24 — bascule lactation longue (trait sans tarir)
    if (body.lactationLongue !== undefined) data.lactationLongue = Boolean(body.lactationLongue)

    const animal = await prisma.animal.update({
      where: { id: parseInt(id) },
      data,
      include: { especeAnimale: true, lot: true },
    })

    return NextResponse.json({ data: animal })
  } catch (error) {
    console.error('PATCH /api/elevage/animaux/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()

    // Vérifier que l'animal appartient à l'utilisateur
    const existing = await prisma.animal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    // Audit élevage 2026-06-11 — garde parents : pas de self-parent, et la
    // mère référencée doit appartenir au user.
    if (body.mereId) {
      const mid = parseInt(body.mereId)
      if (mid === existing.id) {
        return NextResponse.json({ error: 'Un animal ne peut pas être sa propre mère' }, { status: 400 })
      }
      const mere = await prisma.animal.findFirst({
        where: { id: mid, userId: session.user.id },
        select: { id: true },
      })
      if (!mere) {
        return NextResponse.json({ error: 'Animal mère introuvable' }, { status: 400 })
      }
      const lienValide = await verifierLienParenteSansCycle({
        animalId: existing.id,
        parentId: mid,
        chargerParents: (ids) => prisma.animal.findMany({
          where: { userId: session.user.id, id: { in: ids } },
          select: { id: true, mereId: true, pereId: true },
        }),
      })
      if (!lienValide) {
        return NextResponse.json(
          { error: 'Parenté circulaire impossible : la mère proposée descend déjà de cet animal' },
          { status: 400 },
        )
      }
      if (existing.pereId && mid === existing.pereId) {
        return NextResponse.json(
          { error: 'La mère et le père doivent être deux animaux distincts' },
          { status: 400 },
        )
      }
    }

    const {
      especeAnimaleId,
      lotId,
      identifiant,
      nom,
      race,
      raceAnimaleId,
      orientationProduction,
      sexe,
      dateNaissance,
      dateArrivee,
      provenance,
      prixAchat,
      prixAchatInclusDansLot,
      statut,
      dateSortie,
      causeSortie,
      posX,
      posY,
      mereId,
      pereIdentifiant,
      mereIdentifiant,
      poidsActuel,
      couleur,
      notes,
      parcelleGeoId,
    } = body

    const prixFinal = prixAchat === undefined
      ? existing.prixAchat
      : prixAchat === null || prixAchat === ''
        ? null
        : Number(prixAchat)
    if (prixFinal != null && (!Number.isFinite(prixFinal) || prixFinal < 0)) {
      return NextResponse.json({ error: "Prix d'achat invalide" }, { status: 400 })
    }
    const lotCible = lotId === undefined ? existing.lotId : (lotId ? Number(lotId) : null)
    let inclusFinal = prixAchatInclusDansLot === undefined
      ? existing.prixAchatInclusDansLot
      : Boolean(prixAchatInclusDansLot)
    if (lotCible === null) inclusFinal = false
    const lotAchatCible = lotCible != null && (Number(prixFinal || 0) > 0 || inclusFinal)
      ? await prisma.lotAnimaux.findFirst({
          where: { id: lotCible, userId: session.user.id },
          select: { prixAchatTotal: true },
        })
      : null
    const lotPorteAchat = Number(lotAchatCible?.prixAchatTotal || 0) > 0
    if (inclusFinal && (!(Number(prixFinal || 0) > 0) || !lotPorteAchat)) {
      return NextResponse.json(
        { error: "Le prix ne peut être inclus dans le lot que si l'animal et le lot ont tous deux un prix d'achat." },
        { status: 400 },
      )
    }
    if (Number(prixFinal || 0) > 0 && lotPorteAchat && !inclusFinal) {
      return NextResponse.json(
        { error: "Ce lot possède déjà un prix d'achat total. Cochez « prix inclus dans le lot » ou retirez l'un des deux prix." },
        { status: 400 },
      )
    }

    const especeCible = especeAnimaleId ?? existing.especeAnimaleId
    if (orientationProduction !== undefined && orientationProduction !== null && !['lait', 'viande', 'laine', 'mixte'].includes(orientationProduction)) {
      return NextResponse.json({ error: 'Orientation de production invalide' }, { status: 400 })
    }
    const raceRef = raceAnimaleId ? await prisma.raceAnimale.findFirst({
      where: { id: raceAnimaleId, especeAnimaleId: especeCible, AND: [visibiliteReferentiel(session.user.id)] },
      select: { id: true, nom: true },
    }) : null
    if (raceAnimaleId && !raceRef) return NextResponse.json({ error: 'Race incompatible ou inaccessible' }, { status: 400 })

    // On ne (re)valide le lot que s'il CHANGE : conserver un lot inchangé
    // (même devenu inactif) ne doit pas bloquer l'édition de l'animal.
    if (
      lotId !== undefined && lotId !== null && lotId !== '' &&
      Number(lotId) !== existing.lotId &&
      !await isAssignableAnimalLot(
        session.user.id,
        lotId,
        especeAnimaleId ?? existing.especeAnimaleId
      )
    ) {
      return NextResponse.json({ error: 'Lot invalide' }, { status: 400 })
    }

    // Cartographie élevage — parcelle validée propriétaire (null/'' ⇒ détache).
    if (
      parcelleGeoId !== undefined && parcelleGeoId !== null && parcelleGeoId !== '' &&
      parcelleGeoId !== existing.parcelleGeoId &&
      !await isOwnedParcelle(session.user.id, parcelleGeoId)
    ) {
      return NextResponse.json({ error: 'Parcelle invalide' }, { status: 400 })
    }

    // Bug éleveur 2026-07-21 — borne d'année sur les dates (évite "0204").
    for (const [raw, label] of [
      [dateNaissance, 'de naissance'],
      [dateArrivee, "d'arrivée"],
    ] as const) {
      if (raw && !isPlausibleAnimalDate(new Date(raw))) {
        return NextResponse.json(
          { error: `Date ${label} invalide (année attendue entre 1990 et ${new Date().getFullYear() + 1})` },
          { status: 400 }
        )
      }
    }

    const animal = await prisma.$transaction(async (tx) => {
      const updated = await tx.animal.update({
        where: { id: parseInt(id) },
        data: {
        especeAnimaleId,
        lotId: lotId !== undefined ? (lotId ? parseInt(lotId) : null) : undefined,
        identifiant,
        nom,
        race: raceAnimaleId !== undefined ? (raceRef?.nom ?? null) : race,
        raceAnimaleId: raceAnimaleId !== undefined ? (raceRef?.id ?? null) : undefined,
        orientationProduction: orientationProduction !== undefined ? (orientationProduction || null) : undefined,
        sexe,
        dateNaissance: dateNaissance ? new Date(dateNaissance) : undefined,
        dateArrivee: dateArrivee ? new Date(dateArrivee) : undefined,
        provenance,
        prixAchat: prixAchat !== undefined ? prixFinal : undefined,
        prixAchatInclusDansLot:
          prixAchatInclusDansLot !== undefined || lotId !== undefined ? inclusFinal : undefined,
        statut,
        dateSortie: dateSortie ? new Date(dateSortie) : undefined,
        causeSortie,
        posX,
        posY,
        mereId: mereId !== undefined ? (mereId ? parseInt(mereId) : null) : undefined,
        pereIdentifiant,
        mereIdentifiant,
        poidsActuel,
        couleur,
        notes,
        parcelleGeoId: parcelleGeoId !== undefined ? (parcelleGeoId || null) : undefined,
      },
        include: {
          especeAnimale: true,
          lot: true,
        },
      })
      if (lotId !== undefined) {
        await enregistrerChangementLot(tx, session.user.id, existing.id, existing.lotId, updated.lotId)
      }
      if (parcelleGeoId !== undefined && updated.parcelleGeoId !== existing.parcelleGeoId) {
        await tx.mouvementCheptel.create({
          data: {
            userId: session.user.id, animalId: existing.id,
            parcelleAvantId: existing.parcelleGeoId, parcelleApresId: updated.parcelleGeoId,
            date: new Date(), motif: 'Modification de la fiche animal',
          },
        })
      }
      await createDepenseFromAchatAnimal(session.user.id, {
        id: updated.id,
        nom: updated.nom,
        identifiant: updated.identifiant,
        prixAchat: updated.prixAchat,
        dateArrivee: updated.dateArrivee,
        prixAchatInclusDansLot: updated.prixAchatInclusDansLot,
      }, tx)
      return updated
    })
    invalidateKpi(session.user.id)

    return NextResponse.json({ data: animal })
  } catch (error) {
    console.error('PUT /api/elevage/animaux/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { id } = await params

    const existing = await prisma.animal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await deleteAutoEntry(
        'achat_animal_individuel',
        existing.id,
        'depense',
        session.user.id,
        tx,
      )
      await tx.animal.delete({ where: { id: existing.id } })
    })
    invalidateKpi(session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/animaux/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
