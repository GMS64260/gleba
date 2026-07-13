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
