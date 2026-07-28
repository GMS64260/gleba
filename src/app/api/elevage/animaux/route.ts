/**
 * API Animaux
 * GET /api/elevage/animaux - Liste des animaux
 * POST /api/elevage/animaux - Créer un animal
 * PATCH /api/elevage/animaux - Modifier un animal
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createDepenseFromAchatAnimal } from '@/lib/auto-compta'
import { animalSchema, isPlausibleAnimalDate } from '@/lib/validations/elevage-animal'
import { enregistrerChangementLot, isAssignableAnimalLot, isOwnedParcelle } from '@/lib/elevage/animal-lot'
import { verifierLienParenteSansCycle } from '@/lib/elevage/genealogie-validation'
import { visibiliteReferentiel } from '@/lib/referentiel-communaute'
import { invalidateKpi } from '@/lib/kpi'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const especeAnimaleId = searchParams.get('especeAnimaleId')
    const statut = searchParams.get('statut')
    const lotId = searchParams.get('lotId')
    const sexe = searchParams.get('sexe')

    const where: Prisma.AnimalWhereInput = { userId: session.user.id }
    if (especeAnimaleId) where.especeAnimaleId = especeAnimaleId
    if (statut) where.statut = statut
    if (lotId) {
      const parsedLotId = parseInt(lotId, 10)
      if (isNaN(parsedLotId)) {
        return NextResponse.json({ error: 'lotId invalide' }, { status: 400 })
      }
      where.lotId = parsedLotId
    }
    if (sexe) where.sexe = sexe

    const animaux = await prisma.animal.findMany({
      where,
      orderBy: [{ statut: 'asc' }, { nom: 'asc' }],
      include: {
        especeAnimale: {
          // Bug cmp8sf92p — on remonte poidsAdulte pour permettre à la liste
          // d'afficher un poids estimatif si poidsActuel n'est pas saisi.
          // QA caprin cms1va1q7 — dureeGestation sert au filtre d'âge minimal
          // des mères dans le formulaire de naissance.
          select: {
            id: true,
            nom: true,
            type: true,
            filiere: true,
            production: true,
            productions: true,
            couleur: true,
            poidsAdulte: true,
            dureeGestation: true,
          },
        },
        raceAnimale: { select: { id: true, nom: true } },
        lot: {
          select: { id: true, nom: true },
        },
        mere: {
          select: { id: true, nom: true, identifiant: true },
        },
        pere: {
          select: { id: true, nom: true, identifiant: true },
        },
        statutsSanitairesStructures: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            statut: true,
            maladie: { select: { id: true, nom: true } },
          },
        },
        _count: {
          select: {
            productionsOeufs: true,
            soins: true,
            enfants: true,
          },
        },
      },
    })

    return NextResponse.json({ data: animaux })
  } catch (error) {
    console.error('GET /api/elevage/animaux error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des animaux', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const body = await request.json()
    const parsed = animalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      especeAnimaleId,
      lotId,
      identifiant,
      typeIdentifiant,
      nom,
      race,
      raceAnimaleId,
      orientationProduction,
      sexe,
      dateNaissance,
      dateArrivee,
      provenance,
      nExploitationOrigine,
      nExploitationDestination,
      motifSortie,
      statutSanitaire,
      prixAchat,
      prixAchatInclusDansLot,
      statut,
      posX,
      posY,
      mereId,
      pereId,
      pereIdentifiant,
      mereIdentifiant,
      poidsActuel,
      couleur,
      notes,
      parcelleGeoId,
    } = parsed.data

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

    const raceRef = raceAnimaleId ? await prisma.raceAnimale.findFirst({
      where: { id: raceAnimaleId, especeAnimaleId, AND: [visibiliteReferentiel(session.user.id)] },
      select: { id: true, nom: true },
    }) : null
    if (raceAnimaleId && !raceRef) return NextResponse.json({ error: 'Race incompatible ou inaccessible' }, { status: 400 })

    if (lotId != null && !await isAssignableAnimalLot(session.user.id, lotId, especeAnimaleId)) {
      return NextResponse.json({ error: 'Lot invalide' }, { status: 400 })
    }
    const lotAchat = lotId != null && (Number(prixAchat || 0) > 0 || prixAchatInclusDansLot)
      ? await prisma.lotAnimaux.findFirst({
          where: { id: lotId, userId: session.user.id },
          select: { prixAchatTotal: true },
        })
      : null
    const lotPorteAchat = Number(lotAchat?.prixAchatTotal || 0) > 0
    if (prixAchatInclusDansLot && (!(Number(prixAchat || 0) > 0) || !lotPorteAchat)) {
      return NextResponse.json(
        { error: "Le prix ne peut être inclus dans le lot que si l'animal et le lot ont tous deux un prix d'achat." },
        { status: 400 },
      )
    }
    if (Number(prixAchat || 0) > 0 && lotPorteAchat && !prixAchatInclusDansLot) {
      return NextResponse.json(
        { error: "Ce lot possède déjà un prix d'achat total. Indiquez que le prix individuel est inclus dans le lot, ou retirez l'un des deux prix." },
        { status: 400 },
      )
    }

    if (parcelleGeoId != null && !await isOwnedParcelle(session.user.id, parcelleGeoId)) {
      return NextResponse.json({ error: 'Parcelle invalide' }, { status: 400 })
    }

    // Audit élevage 2026-06-11 — validation tenant des parents (avant : un
    // mereId/pereId arbitraire reliait l'animal au cheptel d'un autre compte).
    for (const [label, parentId] of [['mère', mereId], ['père', pereId]] as const) {
      if (parentId) {
        const parent = await prisma.animal.findFirst({
          where: { id: parentId, userId: session.user.id },
          select: { id: true },
        })
        if (!parent) {
          return NextResponse.json({ error: `Animal ${label} introuvable` }, { status: 400 })
        }
      }
    }
    if (mereId && pereId && mereId === pereId) {
      return NextResponse.json({ error: 'La mère et le père doivent être deux animaux distincts' }, { status: 400 })
    }

    const animal = await prisma.$transaction(async (tx) => {
      const created = await tx.animal.create({
        data: {
        userId: session.user.id,
        especeAnimaleId,
        lotId: lotId ?? null,
        identifiant,
        typeIdentifiant: typeIdentifiant ?? null,
        nom,
        race: raceRef?.nom ?? race,
        raceAnimaleId: raceRef?.id ?? null,
        orientationProduction: orientationProduction ?? null,
        sexe,
        dateNaissance: dateNaissance ?? null,
        dateArrivee: dateArrivee ?? new Date(),
        provenance,
        nExploitationOrigine: nExploitationOrigine ?? null,
        nExploitationDestination: nExploitationDestination ?? null,
        motifSortie: motifSortie ?? null,
        statutSanitaire: statutSanitaire ?? [],
        prixAchat,
        prixAchatInclusDansLot,
        statut,
        posX,
        posY,
        mereId: mereId ?? null,
        pereId: pereId ?? null,
        pereIdentifiant,
        mereIdentifiant: mereIdentifiant ?? null,
        poidsActuel,
        couleur,
        notes,
        parcelleGeoId: parcelleGeoId ?? null,
      },
        include: {
          especeAnimale: true,
          lot: true,
        },
      })
      await enregistrerChangementLot(
        tx, session.user.id, created.id, null, created.lotId,
        created.dateArrivee ?? created.createdAt, 'Affectation à la création de l’animal'
      )
      if (created.parcelleGeoId) await tx.mouvementCheptel.create({
        data: {
          userId: session.user.id, animalId: created.id,
          parcelleAvantId: null, parcelleApresId: created.parcelleGeoId,
          date: created.dateArrivee ?? created.createdAt, motif: 'Affectation initiale',
        },
      })
      await createDepenseFromAchatAnimal(session.user.id, {
        id: created.id,
        nom: created.nom,
        identifiant: created.identifiant,
        prixAchat: created.prixAchat,
        dateArrivee: created.dateArrivee,
        prixAchatInclusDansLot: created.prixAchatInclusDansLot,
      }, tx)
      return created
    })
    invalidateKpi(session.user.id)

    const exploitation = await prisma.exploitation.findUnique({
      where: { userId: session.user.id },
      select: { numeroEde: true },
    })

    const avertissements = [
      exploitation?.numeroEde
        ? null
        : 'Numéro EDE non renseigné : complétez-le dans Alimentation > Registre & pharmacie avant toute déclaration réglementaire.',
      (animal.dateArrivee && animal.statutSanitaire.length === 0)
        ? 'Statut sanitaire inconnu à l’introduction : ajoutez les qualifications et le dernier contrôle depuis la fiche de l’animal.'
        : null,
    ].filter((message): message is string => Boolean(message))

    return NextResponse.json(
      {
        data: animal,
        warning: avertissements.length ? avertissements.join(' ') : null,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('POST /api/elevage/animaux error:', error)
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
    const { id, especeAnimaleId, nom, race, raceAnimaleId, orientationProduction, sexe, statut, lotId, posX, posY, poidsActuel, couleur, notes, dateSortie, causeSortie, mereId, pereId, pereIdentifiant, mereIdentifiant, identifiant, typeIdentifiant, nExploitationOrigine, nExploitationDestination, motifSortie, statutSanitaire, prixAchat, prixAchatInclusDansLot, provenance, dateNaissance, dateArrivee, parcelleGeoId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.animal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    // Ticket utilisateur 2026-07-22 — le formulaire envoyait bien la nouvelle
    // espèce/type de production, mais PATCH l'ignorait silencieusement.
    // Vérifier aussi que la nouvelle référence est visible avant de l'appliquer.
    if (especeAnimaleId !== undefined) {
      const espece = await prisma.especeAnimale.findFirst({
        where: {
          id: especeAnimaleId,
          AND: [visibiliteReferentiel(session.user.id)],
        },
        select: { id: true },
      })
      if (!espece) {
        return NextResponse.json({ error: 'Espèce animale invalide' }, { status: 400 })
      }
    }

    const especeCible = especeAnimaleId ?? existing.especeAnimaleId
    const orientations = new Set(['lait', 'viande', 'laine', 'mixte'])
    if (orientationProduction !== undefined && orientationProduction !== null && !orientations.has(orientationProduction)) {
      return NextResponse.json({ error: 'Orientation de production invalide' }, { status: 400 })
    }
    const raceRef = raceAnimaleId ? await prisma.raceAnimale.findFirst({
      where: { id: raceAnimaleId, especeAnimaleId: especeCible, AND: [visibiliteReferentiel(session.user.id)] },
      select: { id: true, nom: true },
    }) : null
    if (raceAnimaleId && !raceRef) return NextResponse.json({ error: 'Race incompatible ou inaccessible' }, { status: 400 })

    // On ne (re)valide le lot que s'il CHANGE : un animal déjà rattaché à un lot
    // devenu inactif (terminé/réformé) doit rester éditable (poids, notes…) sans
    // renvoyer « Lot invalide » alors que l'utilisateur n'y a pas touché.
    const lotCible = lotId === undefined ? existing.lotId : (lotId ? Number(lotId) : null)
    if (
      lotCible !== null &&
      (lotCible !== existing.lotId || especeCible !== existing.especeAnimaleId) &&
      !await isAssignableAnimalLot(session.user.id, lotCible, especeCible)
    ) {
      return NextResponse.json({ error: 'Lot invalide' }, { status: 400 })
    }
    const prixFinal = prixAchat === undefined
      ? existing.prixAchat
      : prixAchat === null || prixAchat === ''
        ? null
        : Number(prixAchat)
    if (prixFinal != null && (!Number.isFinite(prixFinal) || prixFinal < 0)) {
      return NextResponse.json({ error: "Prix d'achat invalide" }, { status: 400 })
    }
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
    const lotPorteAchatFinal = Number(lotAchatCible?.prixAchatTotal || 0) > 0
    if (inclusFinal && (!(Number(prixFinal || 0) > 0) || !lotPorteAchatFinal)) {
      return NextResponse.json(
        { error: "Le prix ne peut être inclus dans le lot que si l'animal et le lot ont tous deux un prix d'achat." },
        { status: 400 },
      )
    }
    if (Number(prixFinal || 0) > 0 && lotPorteAchatFinal && !inclusFinal) {
      return NextResponse.json(
        { error: "Ce lot possède déjà un prix d'achat total. Cochez « prix inclus dans le lot » ou retirez l'un des deux prix." },
        { status: 400 },
      )
    }

    // Cartographie élevage — parcelle validée propriétaire (null/'' ⇒ détache).
    if (
      parcelleGeoId !== undefined && parcelleGeoId !== null && parcelleGeoId !== '' &&
      parcelleGeoId !== existing.parcelleGeoId &&
      !await isOwnedParcelle(session.user.id, parcelleGeoId)
    ) {
      return NextResponse.json({ error: 'Parcelle invalide' }, { status: 400 })
    }

    const updateData: Prisma.AnimalUncheckedUpdateInput = {}
    if (especeAnimaleId !== undefined) updateData.especeAnimaleId = especeAnimaleId
    if (orientationProduction !== undefined) updateData.orientationProduction = orientationProduction || null
    if (raceAnimaleId !== undefined) {
      updateData.raceAnimaleId = raceRef?.id ?? null
      updateData.race = raceRef?.nom ?? null
    }
    if (parcelleGeoId !== undefined) updateData.parcelleGeoId = parcelleGeoId || null
    if (nom !== undefined) updateData.nom = nom
    if (race !== undefined) updateData.race = race
    if (sexe !== undefined) updateData.sexe = sexe
    if (statut !== undefined) updateData.statut = statut
    if (lotId !== undefined) updateData.lotId = lotId ? parseInt(lotId) : null
    if (prixAchatInclusDansLot !== undefined || lotId !== undefined) {
      updateData.prixAchatInclusDansLot = inclusFinal
    }
    if (posX !== undefined) updateData.posX = posX !== null ? parseFloat(posX) : null
    if (posY !== undefined) updateData.posY = posY !== null ? parseFloat(posY) : null
    if (poidsActuel !== undefined) updateData.poidsActuel = poidsActuel ? parseFloat(poidsActuel) : null
    if (couleur !== undefined) updateData.couleur = couleur
    if (notes !== undefined) updateData.notes = notes
    if (dateSortie !== undefined) updateData.dateSortie = dateSortie ? new Date(dateSortie) : null
    if (causeSortie !== undefined) updateData.causeSortie = causeSortie
    const mereIdModifie = mereId === undefined ? undefined : (mereId ? Number(mereId) : null)
    const pereIdModifie = pereId === undefined ? undefined : (pereId ? Number(pereId) : null)
    for (const [label, parentId] of [['mère', mereIdModifie], ['père', pereIdModifie]] as const) {
      if (parentId !== undefined && parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
        return NextResponse.json({ error: `Identifiant de ${label} invalide` }, { status: 400 })
      }
    }
    if (mereIdModifie !== undefined) updateData.mereId = mereIdModifie
    if (pereIdModifie !== undefined) updateData.pereId = pereIdModifie

    // Audit élevage 2026-06-11 — un animal ne peut pas être son propre
    // parent (générait un arbre généalogique absurde) et les parents
    // doivent appartenir au user.
    for (const [label, parentId] of [['mère', mereIdModifie], ['père', pereIdModifie]] as const) {
      if (parentId) {
        if (parentId === existing.id) {
          return NextResponse.json({ error: `Un animal ne peut pas être sa propre ${label}` }, { status: 400 })
        }
        const parent = await prisma.animal.findFirst({
          where: { id: parentId, userId: session.user.id },
          select: { id: true },
        })
        if (!parent) {
          return NextResponse.json({ error: `Animal ${label} introuvable` }, { status: 400 })
        }
        const lienValide = await verifierLienParenteSansCycle({
          animalId: existing.id,
          parentId,
          chargerParents: (ids) => prisma.animal.findMany({
            where: { userId: session.user.id, id: { in: ids } },
            select: { id: true, mereId: true, pereId: true },
          }),
        })
        if (!lienValide) {
          return NextResponse.json(
            { error: `Parenté circulaire impossible : le parent proposé (${label}) descend déjà de cet animal` },
            { status: 400 },
          )
        }
      }
    }
    const mereCible = mereIdModifie !== undefined ? mereIdModifie : existing.mereId
    const pereCible = pereIdModifie !== undefined ? pereIdModifie : existing.pereId
    if (mereCible && pereCible && mereCible === pereCible) {
      return NextResponse.json({ error: 'La mère et le père doivent être deux animaux distincts' }, { status: 400 })
    }
    if (provenance !== undefined) updateData.provenance = provenance ?? null
    // Bug éleveur 2026-07-21 (Cyril) — prixAchat était absent du PATCH : toute
    // modification du prix d'achat (notamment la remise à 0 d'un achat saisi par
    // erreur) était silencieusement ignorée, sans erreur. On l'applique désormais,
    // 0 compris (0/null ⇒ la resync auto-compta ci-dessous supprime la dépense).
    if (prixAchat !== undefined) {
      updateData.prixAchat = prixFinal
    }
    // Bug éleveur 2026-07-21 — dates de naissance/arrivée aussi ignorées par le
    // PATCH, et sans borne d'année (faute de frappe "0204" au lieu de "2024").
    for (const [field, raw, label] of [
      ['dateNaissance', dateNaissance, 'de naissance'],
      ['dateArrivee', dateArrivee, "d'arrivée"],
    ] as const) {
      if (raw === undefined) continue
      if (raw === null || raw === '') { updateData[field] = null; continue }
      const d = new Date(raw)
      if (!isPlausibleAnimalDate(d)) {
        return NextResponse.json(
          { error: `Date ${label} invalide (année attendue entre 1990 et ${new Date().getFullYear() + 1})` },
          { status: 400 }
        )
      }
      updateData[field] = d
    }
    if (pereIdentifiant !== undefined) updateData.pereIdentifiant = pereIdentifiant ?? null
    if (mereIdentifiant !== undefined) updateData.mereIdentifiant = mereIdentifiant ?? null
    if (identifiant !== undefined) updateData.identifiant = identifiant ?? null
    if (typeIdentifiant !== undefined) updateData.typeIdentifiant = typeIdentifiant ?? null
    if (nExploitationOrigine !== undefined) updateData.nExploitationOrigine = nExploitationOrigine ?? null
    if (nExploitationDestination !== undefined) updateData.nExploitationDestination = nExploitationDestination ?? null
    if (motifSortie !== undefined) updateData.motifSortie = motifSortie ?? null
    if (statutSanitaire !== undefined) updateData.statutSanitaire = Array.isArray(statutSanitaire) ? statutSanitaire : []

    const animal = await prisma.$transaction(async (tx) => {
      const updated = await tx.animal.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          especeAnimale: { select: { id: true, nom: true, type: true, couleur: true } },
          lot: { select: { id: true, nom: true } },
        },
      })
      if (updateData.lotId !== undefined) {
        await enregistrerChangementLot(tx, session.user.id, existing.id, existing.lotId, updated.lotId)
      }
      if (updateData.parcelleGeoId !== undefined && updated.parcelleGeoId !== existing.parcelleGeoId) {
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
    console.error('PATCH /api/elevage/animaux error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
