/**
 * Cycle de vie d'un compte — reprise du référentiel par la communauté.
 *
 * Décision produit #2 : lorsqu'un membre est supprimé, ses entrées de référentiel
 * PARTAGÉES à la communauté (partageCommunaute=true) sont réattribuées à la
 * sentinelle « Communauté Gleba » (elles restent visibles et utilisables par les
 * autres membres, badge « Communauté »). Ses entrées PRIVÉES (partageCommunaute=false)
 * restent rattachées à son user_id et sont supprimées par le cascade au delete du
 * compte. On appelle donc reprendreReferentielCommunaute() DANS la même transaction,
 * AVANT prisma.user.delete().
 *
 * Fichier SERVEUR uniquement (utilise Prisma) — ne pas importer côté client.
 */

import type { Prisma } from '@prisma/client'

/** Id fixe du compte système sentinelle (cf. migration 20260713160000_sentinelle_communaute). */
export const COMMUNAUTE_USER_ID = 'gleba-communaute'

/**
 * Réattribue à la sentinelle « Communauté Gleba » toutes les entrées de référentiel
 * PARTAGÉES du membre `userId`, sur les 8 référentiels communautaires. Renvoie le
 * nombre total d'entrées reprises. À exécuter dans la transaction de suppression du
 * compte, avant le delete (les entrées privées, elles, partiront en cascade).
 */
export async function reprendreReferentielCommunaute(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<{ reprises: number }> {
  const cible = { userId: COMMUNAUTE_USER_ID }

  // Étape 1 — sauver les PARENTS privés des enfants partagés. Variete.espece et
  // RaceAnimale.especeAnimale sont onDelete:Cascade : si le parent (resté privé,
  // donc rattaché au membre) partait avec le compte, l'enfant partagé qu'on vient
  // de reprendre serait détruit en cascade. On réattribue donc à la sentinelle les
  // parents (appartenant au membre) d'au moins un enfant partagé, en les rendant
  // communautaires (cohérent : leur enfant est déjà public). Correctif review #5.
  const varietesPartagees = await tx.variete.findMany({
    where: { userId, partageCommunaute: true },
    select: { especeId: true },
  })
  const especeParentIds = [...new Set(varietesPartagees.map((v) => v.especeId))]
  if (especeParentIds.length > 0) {
    await tx.espece.updateMany({
      where: { id: { in: especeParentIds }, userId },
      data: { ...cible, partageCommunaute: true },
    })
  }

  const racesPartagees = await tx.raceAnimale.findMany({
    where: { userId, partageCommunaute: true },
    select: { especeAnimaleId: true },
  })
  const especeAnimParentIds = [...new Set(racesPartagees.map((r) => r.especeAnimaleId))]
  if (especeAnimParentIds.length > 0) {
    await tx.especeAnimale.updateMany({
      where: { id: { in: especeAnimParentIds }, userId },
      data: { ...cible, partageCommunaute: true },
    })
  }

  // Étape 2 — réattribuer à la sentinelle toutes les entrées PARTAGÉES du membre
  // (les parents déplacés en étape 1 ne matchent plus userId, donc pas de double).
  const where = { userId, partageCommunaute: true }
  const resultats = await Promise.all([
    tx.espece.updateMany({ where, data: cible }),
    tx.variete.updateMany({ where, data: cible }),
    tx.iTP.updateMany({ where, data: cible }),
    tx.porteGreffe.updateMany({ where, data: cible }),
    tx.essenceBocagere.updateMany({ where, data: cible }),
    tx.essenceForestiere.updateMany({ where, data: cible }),
    tx.especeAnimale.updateMany({ where, data: cible }),
    tx.raceAnimale.updateMany({ where, data: cible }),
  ])

  return { reprises: resultats.reduce((n, r) => n + r.count, 0) }
}
