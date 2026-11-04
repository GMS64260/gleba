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

import { rm } from 'node:fs/promises'
import path from 'node:path'

import type { Prisma } from '@prisma/client'

/** Id fixe du compte système sentinelle (cf. migration 20260713160000_sentinelle_communaute). */
export const COMMUNAUTE_USER_ID = 'gleba-communaute'

/**
 * Les quatre emplacements de fichiers rattachés à un compte, tous organisés en
 * un dossier par `userId` et montés sur un volume Docker distinct. Le cascade
 * SQL n'emporte que les lignes : sans ce ménage, les fichiers survivraient à la
 * suppression du compte (cf. RGPD et politique Google Play sur la suppression).
 */
function dossiersFichiersUtilisateur(userId: string): string[] {
  const racine = process.cwd()
  return [
    path.join(racine, 'public', 'uploads', userId),
    path.join(racine, 'storage', 'justificatifs', userId),
    path.join(racine, 'storage', 'plan-fonds', userId),
    path.join(racine, 'storage', 'registres', userId),
  ]
}

/**
 * Supprime les fichiers du membre `userId` sur les quatre volumes. À appeler
 * APRÈS le commit de la transaction de suppression : un échec disque ne doit pas
 * annuler la suppression en base, qui est ce que l'utilisateur a demandé. Les
 * erreurs sont donc journalisées et le nombre de dossiers effacés est renvoyé.
 */
export async function supprimerFichiersUtilisateur(
  userId: string
): Promise<{ dossiersSupprimes: number; echecs: string[] }> {
  const echecs: string[] = []
  let dossiersSupprimes = 0

  for (const dossier of dossiersFichiersUtilisateur(userId)) {
    try {
      await rm(dossier, { recursive: true, force: true })
      dossiersSupprimes++
    } catch (error) {
      echecs.push(dossier)
      console.error('supprimerFichiersUtilisateur:', dossier, error)
    }
  }

  return { dossiersSupprimes, echecs }
}

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
  // Ordonner une suppression et une publication simultanées : la publication
  // prend un verrou KEY SHARE sur ce même auteur avant d'inscrire sa version.
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`
  // L'historique documentaire reste utile, mais sa signature ne doit pas
  // identifier un compte supprimé. Les références techniques sont détachées
  // par les clés étrangères SetNull dans la même transaction.
  await tx.revisionEncyclopedie.updateMany({
    where: { authorId: userId },
    data: { signature: 'Ancien membre' },
  })
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

  // Même symétrie pour les ITP partagés, qui manquait : `ITP.espece` est
  // onDelete:SetNull, donc l'itinéraire survit — mais SANS son espèce. Un
  // « zinnia s1 » proposé à la communauté par un membre dont l'espèce « zinnia »
  // restait privée se retrouvait dans le catalogue commun avec « - » en espèce,
  // sans couleur de famille, et écarté de tous les sélecteurs (qui filtrent par
  // especeId).
  const itpsPartages = await tx.iTP.findMany({
    where: { userId, partageCommunaute: true, especeId: { not: null } },
    select: { especeId: true },
  })
  const especeItpParentIds = [
    ...new Set(itpsPartages.map((i) => i.especeId).filter(Boolean) as string[]),
  ]
  if (especeItpParentIds.length > 0) {
    await tx.espece.updateMany({
      where: { id: { in: especeItpParentIds }, userId },
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

  // Étape 1 bis — sauver les ITP dont d'AUTRES membres dépendent, même restés
  // privés. `DELETE /api/itps/[id]` refuse en 409 de supprimer un itinéraire
  // porteur de cultures ou d'étapes de rotation ; la suppression de compte
  // contournait cette garde : l'itinéraire partait en cascade et les cultures des
  // autres membres perdaient leur itpId en silence (SetNull). Mêmes critères que
  // le 409, donc même promesse tenue.
  const itpsUtilisesAilleurs = await tx.iTP.findMany({
    where: {
      userId,
      partageCommunaute: false,
      OR: [{ cultures: { some: { userId: { not: userId } } } }, { rotationsDetails: { some: {} } }],
    },
    select: { id: true, especeId: true },
  })
  if (itpsUtilisesAilleurs.length > 0) {
    await tx.iTP.updateMany({
      where: { id: { in: itpsUtilisesAilleurs.map((i) => i.id) } },
      data: { ...cible, partageCommunaute: true },
    })
    // Et leur espèce parente, pour la même raison qu'au-dessus.
    const parents = [
      ...new Set(itpsUtilisesAilleurs.map((i) => i.especeId).filter(Boolean) as string[]),
    ]
    if (parents.length > 0) {
      await tx.espece.updateMany({
        where: { id: { in: parents }, userId },
        data: { ...cible, partageCommunaute: true },
      })
    }
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

/**
 * Supprime les données du compte que la cascade SQL n'atteint pas.
 *
 * Neuf tables d'élevage portent `user_id` sans clé étrangère (migrations de
 * juillet 2026 : pesées, réservations avec nom, courriel et téléphone des
 * acquéreurs, tests de santé, pedigrees, rations, prophylaxies, tâches de
 * terrain et leurs réalisations, historique des lots), et les aliments privés
 * portent leur propriétaire dans `owner_user_id`, sans relation. La suppression
 * d'un compte, par le membre comme par l'administration, comptait sur la
 * cascade de `users` : ces lignes survivaient alors que l'écran annonçait
 * « définitivement supprimés » (revue du 2026-11-04).
 *
 * À appeler dans la transaction de suppression, APRÈS `user.delete` : les
 * consommations d'aliments du compte sont alors parties en cascade, et un
 * aliment privé encore référencé ailleurs (clé `Restrict`) est laissé plutôt
 * que de faire échouer la suppression du compte.
 */
export async function supprimerDonneesSansCleEtrangere(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<number> {
  const resultats = await Promise.all([
    tx.pesee.deleteMany({ where: { userId } }),
    tx.reservationElevage.deleteMany({ where: { userId } }),
    tx.testSanteElevage.deleteMany({ where: { userId } }),
    tx.pedigreeElevage.deleteMany({ where: { userId } }),
    tx.planRation.deleteMany({ where: { userId } }),
    tx.prophylaxieElevage.deleteMany({ where: { userId } }),
    tx.realisationTacheElevage.deleteMany({ where: { userId } }),
    tx.tacheTerrainElevage.deleteMany({ where: { userId } }),
    tx.historiqueLotAnimal.deleteMany({ where: { userId } }),
  ])
  const aliments = await tx.aliment.deleteMany({
    where: { ownerUserId: userId, consommations: { none: {} } },
  })
  return resultats.reduce((n, r) => n + r.count, 0) + aliments.count
}
