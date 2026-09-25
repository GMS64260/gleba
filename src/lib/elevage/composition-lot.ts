/**
 * Composition d'un lot d'animaux en une fois (ajouts et retraits), partagée
 * par l'écran (POST /api/elevage/lots/[id]/animaux) et l'assistant (outil
 * affecter_animaux_lot, update_animal avec lotId).
 *
 * Signalement 2026-09-25 : un éleveur caprin a dû rattacher 11 chèvres au lot
 * « adultes traite 2025 » une par une, fiche après fiche, et l'assistant ne
 * savait pas le faire. Chaque changement suit les règles de la fiche animal :
 * lot actif de la même espèce, prix d'achat « inclus » cohérent, historique
 * des lots tenu. Tout ou rien : la moindre incohérence refuse l'ensemble.
 */

import prisma from '@/lib/prisma'
import { createDepenseFromAchatAnimal } from '@/lib/auto-compta'
import { enregistrerChangementLot, regleAchatInclusLot } from '@/lib/elevage/animal-lot'
import { especeBaseId } from '@/lib/elevage/espece-base'
import { invalidateKpi } from '@/lib/kpi'

const MOTIF = 'Composition du lot'

export interface RefusComposition {
  animalId: number
  animal: string
  raison: string
}

export async function composerLot(
  userId: string,
  lotId: number,
  demande: { ajouter: number[]; retirer: number[] },
) {
  const ajouter = [...new Set(demande.ajouter)]
  const retirer = [...new Set(demande.retirer)].filter((id) => !ajouter.includes(id))
  const lot = await prisma.lotAnimaux.findFirst({
    where: { id: lotId, userId },
    select: { id: true, nom: true, statut: true, especeAnimaleId: true, prixAchatTotal: true },
  })
  if (!lot) return { ok: false as const, status: 404, error: 'Lot non trouvé' }
  if (ajouter.length > 0 && lot.statut !== 'actif') {
    return { ok: false as const, status: 409, error: 'Ce lot est clôturé : réactivez-le avant d’y ajouter des animaux.' }
  }

  const animaux = await prisma.animal.findMany({
    where: { userId, id: { in: [...ajouter, ...retirer] } },
    select: {
      id: true, nom: true, identifiant: true, statut: true, especeAnimaleId: true,
      lotId: true, prixAchat: true, prixAchatInclusDansLot: true, dateArrivee: true,
    },
  })
  const parId = new Map(animaux.map((a) => [a.id, a]))
  const introuvables = [...ajouter, ...retirer].filter((id) => !parId.has(id))
  if (introuvables.length > 0) {
    return { ok: false as const, status: 404, error: `Animal introuvable : #${introuvables.join(', #')}` }
  }

  const libelle = (a: { nom: string | null; identifiant: string | null; id: number }) =>
    a.nom || a.identifiant || `#${a.id}`
  const lotPorteAchat = Number(lot.prixAchatTotal || 0) > 0
  const refus: RefusComposition[] = []
  const changements: Array<{ animal: (typeof animaux)[number]; lotCible: number | null; inclus: boolean }> = []

  for (const id of ajouter) {
    const animal = parId.get(id)!
    if (animal.lotId === lot.id) continue
    if (animal.statut !== 'actif') {
      refus.push({ animalId: id, animal: libelle(animal), raison: `animal ${animal.statut}, plus présent au cheptel` })
      continue
    }
    if (especeBaseId(animal.especeAnimaleId) !== especeBaseId(lot.especeAnimaleId)) {
      refus.push({ animalId: id, animal: libelle(animal), raison: "espèce différente de celle du lot" })
      continue
    }
    const { inclus, erreur } = regleAchatInclusLot({
      prixAchat: animal.prixAchat,
      inclusDemande: animal.prixAchatInclusDansLot,
      lotCible: lot.id,
      lotPorteAchat,
    })
    if (erreur) {
      refus.push({ animalId: id, animal: libelle(animal), raison: erreur })
      continue
    }
    changements.push({ animal, lotCible: lot.id, inclus })
  }
  for (const id of retirer) {
    const animal = parId.get(id)!
    if (animal.lotId !== lot.id) continue
    const { inclus } = regleAchatInclusLot({
      prixAchat: animal.prixAchat,
      inclusDemande: animal.prixAchatInclusDansLot,
      lotCible: null,
      lotPorteAchat: false,
    })
    changements.push({ animal, lotCible: null, inclus })
  }

  if (refus.length > 0) {
    return {
      ok: false as const,
      status: 400,
      error: `Aucun changement enregistré : ${refus.map((r) => `${r.animal} (${r.raison})`).join(' ; ')}`,
      details: refus,
    }
  }

  const dateEffet = new Date()
  await prisma.$transaction(async (tx) => {
    for (const { animal, lotCible, inclus } of changements) {
      await tx.animal.update({
        where: { id: animal.id },
        data: { lotId: lotCible, prixAchatInclusDansLot: inclus },
      })
      await enregistrerChangementLot(tx, userId, animal.id, animal.lotId, lotCible, dateEffet, MOTIF)
      if (inclus !== animal.prixAchatInclusDansLot) {
        await createDepenseFromAchatAnimal(userId, {
          id: animal.id,
          nom: animal.nom,
          identifiant: animal.identifiant,
          prixAchat: animal.prixAchat,
          dateArrivee: animal.dateArrivee,
          prixAchatInclusDansLot: inclus,
        }, tx)
      }
    }
  }, { timeout: 30_000 })
  invalidateKpi(userId)

  return {
    ok: true as const,
    lot: { id: lot.id, nom: lot.nom },
    ajoutes: changements.filter((c) => c.lotCible !== null).length,
    retires: changements.filter((c) => c.lotCible === null).length,
  }
}
