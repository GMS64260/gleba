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
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'

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
          },
        },
        enfants: {
          select: { id: true, nom: true, identifiant: true, sexe: true, dateNaissance: true, statut: true },
        },
        naissancesMere: {
          orderBy: { date: 'desc' },
          take: 10,
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

    // Auto-comptabilite : resynchroniser la depense auto avec les valeurs finales
    try {
      await createDepenseFromAchatAnimal(session.user.id, {
        id: animal.id,
        nom: animal.nom,
        identifiant: animal.identifiant,
        prixAchat: animal.prixAchat,
        dateArrivee: animal.dateArrivee,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (achat_animal_individuel PATCH):', autoComptaError)
    }

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
        prixAchat,
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
      return updated
    })

    // Auto-comptabilite : resynchroniser la depense auto avec les valeurs finales
    // (le helper supprime l'ecriture si prixAchat devient null/0)
    try {
      await createDepenseFromAchatAnimal(session.user.id, {
        id: animal.id,
        nom: animal.nom,
        identifiant: animal.identifiant,
        prixAchat: animal.prixAchat,
        dateArrivee: animal.dateArrivee,
      })
    } catch (autoComptaError) {
      console.error('Auto-compta error (achat_animal_individuel PUT):', autoComptaError)
    }

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

    // Supprimer les ecritures auto-compta liees
    try {
      await deleteAutoEntry('achat_animal_individuel', parseInt(id), 'depense')
    } catch (autoComptaError) {
      console.error('Auto-compta cleanup error (achat_animal_individuel):', autoComptaError)
    }

    await prisma.animal.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/elevage/animaux/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
