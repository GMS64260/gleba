/**
 * API Animaux
 * GET /api/elevage/animaux - Liste des animaux
 * POST /api/elevage/animaux - Créer un animal
 * PATCH /api/elevage/animaux - Modifier un animal
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { createDepenseFromAchatAnimal } from '@/lib/auto-compta'
import { animalSchema, isPlausibleAnimalDate } from '@/lib/validations/elevage-animal'
import { isAssignableAnimalLot, isOwnedParcelle } from '@/lib/elevage/animal-lot'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const especeAnimaleId = searchParams.get('especeAnimaleId')
    const statut = searchParams.get('statut')
    const lotId = searchParams.get('lotId')
    const sexe = searchParams.get('sexe')

    const where: any = { userId: session.user.id }
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
          select: { id: true, nom: true, type: true, couleur: true, poidsAdulte: true },
        },
        lot: {
          select: { id: true, nom: true },
        },
        mere: {
          select: { id: true, nom: true, identifiant: true },
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
      sexe,
      dateNaissance,
      dateArrivee,
      provenance,
      nExploitationOrigine,
      nExploitationDestination,
      motifSortie,
      statutSanitaire,
      prixAchat,
      statut,
      posX,
      posY,
      mereId,
      pereId,
      pereIdentifiant,
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

    if (lotId != null && !await isAssignableAnimalLot(session.user.id, lotId, especeAnimaleId)) {
      return NextResponse.json({ error: 'Lot invalide' }, { status: 400 })
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

    const animal = await prisma.animal.create({
      data: {
        userId: session.user.id,
        especeAnimaleId,
        lotId: lotId ?? null,
        identifiant,
        typeIdentifiant: typeIdentifiant ?? null,
        nom,
        race,
        sexe,
        dateNaissance: dateNaissance ?? null,
        dateArrivee: dateArrivee ?? new Date(),
        provenance,
        nExploitationOrigine: nExploitationOrigine ?? null,
        nExploitationDestination: nExploitationDestination ?? null,
        motifSortie: motifSortie ?? null,
        statutSanitaire: statutSanitaire ?? [],
        prixAchat,
        statut,
        posX,
        posY,
        mereId: mereId ?? null,
        pereId: pereId ?? null,
        pereIdentifiant,
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

    // Auto-comptabilite : creer une depense si prixAchat > 0
    if (animal.prixAchat && animal.prixAchat > 0) {
      try {
        await createDepenseFromAchatAnimal(session.user.id, {
          id: animal.id,
          nom: animal.nom,
          identifiant: animal.identifiant,
          prixAchat: animal.prixAchat,
          dateArrivee: animal.dateArrivee,
        })
      } catch (autoComptaError) {
        console.error('Auto-compta error (achat_animal_individuel POST):', autoComptaError)
      }
    }

    return NextResponse.json({ data: animal }, { status: 201 })
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
    const { id, nom, race, sexe, statut, lotId, posX, posY, poidsActuel, couleur, notes, dateSortie, causeSortie, mereId, pereId, pereIdentifiant, identifiant, typeIdentifiant, nExploitationOrigine, nExploitationDestination, motifSortie, statutSanitaire, prixAchat, provenance, dateNaissance, dateArrivee, parcelleGeoId } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const existing = await prisma.animal.findFirst({
      where: { id: parseInt(id), userId: session.user.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Animal non trouvé' }, { status: 404 })
    }

    // On ne (re)valide le lot que s'il CHANGE : un animal déjà rattaché à un lot
    // devenu inactif (terminé/réformé) doit rester éditable (poids, notes…) sans
    // renvoyer « Lot invalide » alors que l'utilisateur n'y a pas touché.
    if (
      lotId !== undefined && lotId !== null && lotId !== '' &&
      Number(lotId) !== existing.lotId &&
      !await isAssignableAnimalLot(session.user.id, lotId, existing.especeAnimaleId)
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

    const updateData: any = {}
    if (parcelleGeoId !== undefined) updateData.parcelleGeoId = parcelleGeoId || null
    if (nom !== undefined) updateData.nom = nom
    if (race !== undefined) updateData.race = race
    if (sexe !== undefined) updateData.sexe = sexe
    if (statut !== undefined) updateData.statut = statut
    if (lotId !== undefined) updateData.lotId = lotId ? parseInt(lotId) : null
    if (posX !== undefined) updateData.posX = posX !== null ? parseFloat(posX) : null
    if (posY !== undefined) updateData.posY = posY !== null ? parseFloat(posY) : null
    if (poidsActuel !== undefined) updateData.poidsActuel = poidsActuel ? parseFloat(poidsActuel) : null
    if (couleur !== undefined) updateData.couleur = couleur
    if (notes !== undefined) updateData.notes = notes
    if (dateSortie !== undefined) updateData.dateSortie = dateSortie ? new Date(dateSortie) : null
    if (causeSortie !== undefined) updateData.causeSortie = causeSortie
    if (mereId !== undefined) updateData.mereId = mereId ? parseInt(mereId) : null
    if (pereId !== undefined) updateData.pereId = pereId ? parseInt(pereId) : null

    // Audit élevage 2026-06-11 — un animal ne peut pas être son propre
    // parent (générait un arbre généalogique absurde) et les parents
    // doivent appartenir au user.
    for (const [label, parentId] of [['mère', updateData.mereId], ['père', updateData.pereId]] as const) {
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
      }
    }
    if (provenance !== undefined) updateData.provenance = provenance ?? null
    // Bug éleveur 2026-07-21 (Cyril) — prixAchat était absent du PATCH : toute
    // modification du prix d'achat (notamment la remise à 0 d'un achat saisi par
    // erreur) était silencieusement ignorée, sans erreur. On l'applique désormais,
    // 0 compris (0/null ⇒ la resync auto-compta ci-dessous supprime la dépense).
    if (prixAchat !== undefined) {
      const p = prixAchat === null || prixAchat === '' ? null : Number(prixAchat)
      updateData.prixAchat = p === null || Number.isNaN(p) ? null : p
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
    if (identifiant !== undefined) updateData.identifiant = identifiant ?? null
    if (typeIdentifiant !== undefined) updateData.typeIdentifiant = typeIdentifiant ?? null
    if (nExploitationOrigine !== undefined) updateData.nExploitationOrigine = nExploitationOrigine ?? null
    if (nExploitationDestination !== undefined) updateData.nExploitationDestination = nExploitationDestination ?? null
    if (motifSortie !== undefined) updateData.motifSortie = motifSortie ?? null
    if (statutSanitaire !== undefined) updateData.statutSanitaire = Array.isArray(statutSanitaire) ? statutSanitaire : []

    const animal = await prisma.animal.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        especeAnimale: { select: { id: true, nom: true, type: true, couleur: true } },
        lot: { select: { id: true, nom: true } },
      },
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
      console.error('Auto-compta error (achat_animal_individuel PATCH):', autoComptaError)
    }

    return NextResponse.json({ data: animal })
  } catch (error) {
    console.error('PATCH /api/elevage/animaux error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour', details: "Erreur interne du serveur" },
      { status: 500 }
    )
  }
}
