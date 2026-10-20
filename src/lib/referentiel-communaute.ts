/**
 * Modèle communautaire partagé du référentiel Gleba — « le Wikipedia du
 * référentiel » (espèces, variétés, ITP, porte-greffes, essences bocagères et
 * forestières). Chaque entité de référentiel porte deux champs harmonisés :
 *
 *   - userId : null = catalogue Gleba officiel (seed) ; sinon = créé par un membre.
 *   - partageCommunaute : true = proposé/partagé à la communauté (visible par tous) ;
 *     false = privé (visible par l'auteur seul).
 *
 * Ce module centralise la règle de visibilité, les libellés d'origine et
 * l'attribution à la création, pour un comportement identique partout.
 */

export type OrigineReferentiel = 'gleba' | 'communaute' | 'perso'

export interface EntreeReferentiel {
  userId?: string | null
  partageCommunaute?: boolean | null
}

/**
 * Fragment Prisma `where` : une entrée est visible si elle est Gleba officiel
 * (userId null), partagée à la communauté, ou créée par l'utilisateur courant.
 * À combiner avec les autres filtres via `{ AND: [autresFiltres, visibiliteReferentiel(userId)] }`.
 */
export function visibiliteReferentiel(userId: string) {
  return { OR: [{ userId: null }, { partageCommunaute: true }, { userId }] }
}

/**
 * Miroir en mémoire de `visibiliteReferentiel`, pour une entrée déjà lue par
 * un chemin qui ne peut pas filtrer en base (résolution partagée avec
 * l'administration, par exemple).
 */
export function estVisibleReferentiel(entree: EntreeReferentiel, userId: string): boolean {
  return entree.userId == null || entree.partageCommunaute === true || entree.userId === userId
}

/**
 * Fragment `where` d'une entrée visée par son id pour la modifier ou la
 * supprimer. Un membre n'atteint que ce qu'il voit : l'entrée privée d'un
 * autre compte répond comme une entrée inexistante (404), jamais 403, qui
 * confirmerait son existence. Un admin atteint toute entrée (modération des
 * signalements). Le droit d'écrire reste `peutEditerReferentiel`.
 */
export function whereReferentielCible(id: string, userId: string, isAdmin: boolean) {
  return isAdmin ? { id } : { id, AND: [visibiliteReferentiel(userId)] }
}

/**
 * Marqueur d'origine d'une entrée créée par un AUTRE compte. Aucune réponse
 * d'API ne porte l'id d'un autre compte (revue du 2026-10-20 : l'id de
 * l'auteur d'un porte-greffe communautaire servait d'`operateurId` pour faire
 * sortir un nom tiers au registre phyto). Les écrans n'ont besoin que de
 * l'origine, que `origineReferentiel` lit aussi bien sur le marqueur.
 */
export const PROPRIETAIRE_COMMUNAUTE = 'communaute'

/** `userId` d'une entrée tel qu'il sort d'une API : null (Gleba), l'id du compte courant (perso), sinon le marqueur. */
export function masquerProprietaire(
  userId: string | null | undefined,
  currentUserId: string
): string | null {
  if (userId == null) return null
  return userId === currentUserId ? userId : PROPRIETAIRE_COMMUNAUTE
}

/** Copie de l'entrée dont le `userId` ne nomme jamais un autre compte. */
export function masquerEntree<T extends { userId?: string | null }>(entree: T, currentUserId: string): T {
  if (!('userId' in entree)) return entree
  return { ...entree, userId: masquerProprietaire(entree.userId, currentUserId) }
}

/** Origine d'une entrée vis-à-vis de l'utilisateur courant. */
export function origineReferentiel(
  entree: EntreeReferentiel,
  currentUserId?: string | null
): OrigineReferentiel {
  if (entree.userId == null) return 'gleba'
  if (currentUserId && entree.userId === currentUserId) return 'perso'
  return 'communaute'
}

/** Badge d'affichage (null pour Gleba officiel = pas de badge, c'est le défaut). */
export function badgeOrigine(
  entree: EntreeReferentiel,
  currentUserId?: string | null
): { label: string; cls: string } | null {
  const o = origineReferentiel(entree, currentUserId)
  if (o === 'perso') return { label: 'Perso', cls: 'bg-amber-100 text-amber-700' }
  if (o === 'communaute') return { label: 'Communauté', cls: 'bg-sky-100 text-sky-700' }
  return null
}

/** Un utilisateur (non-admin) peut-il modifier/supprimer cette entrée ? (seulement ses perso) */
export function peutEditerReferentiel(
  entree: EntreeReferentiel,
  currentUserId: string,
  isAdmin: boolean
): boolean {
  return isAdmin || entree.userId === currentUserId
}

/**
 * Champs d'attribution à la création :
 * - admin → catalogue Gleba officiel (userId null) ;
 * - utilisateur → perso (userId = lui), proposé à la communauté ou privé.
 */
export function attributionCreation(
  isAdmin: boolean,
  userId: string,
  partageCommunaute?: boolean
): { userId: string | null; partageCommunaute: boolean } {
  return isAdmin
    ? { userId: null, partageCommunaute: false }
    : { userId, partageCommunaute: partageCommunaute === true }
}
