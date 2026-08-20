/**
 * Projection de récolte à partir d'un rendement de référentiel.
 *
 * `Espece.rendement` est un nombre dont le SENS dépend de `Espece.uniteRendement`
 * (cf. docs/conventions.md) : kg/m², kg/arbre, t/ha, et depuis le 2026-08-20
 * tiges/m², pièces/m² ou bottes/m². Trois consommateurs le
 * multipliaient pourtant par une surface sans jamais lire l'unité — le Kiwi
 * (25 kg/arbre) annonçait 750 kg sur 30 m², le Tournesol (2,5 t/ha) 45 kg au
 * lieu de 4,5. Toute la projection annuelle, le KPI « Récoltes attendues » et
 * le graphique mensuel étaient faux dès qu'un fruitier ou un engrais vert
 * entrait dans le plan.
 *
 * Une seule conversion, ici, pour la planification, le tableau de bord et
 * l'agrégat KPI. Ne pas réintroduire de `surface * rendement` local.
 */

import { UNITE_RENDEMENT } from '@/lib/validations/espece'

/** Unités connues de `Espece.uniteRendement`. Défaut schéma : `kg_m2`. */
export type UniteRendement = (typeof UNITE_RENDEMENT)[number]

/**
 * Unité de la QUANTITÉ récoltée — ce que compte une projection ou un objectif.
 *
 * Distincte de l'unité de rendement, qui est une densité : `tiges_m2` (densité)
 * produit des `tige` (quantité). Sans cette distinction, un objectif « 1 300 »
 * n'aurait pas d'unité et le kilo se réinstallerait par défaut dans l'affichage.
 */
export type UniteQuantite = 'kg' | 'tige' | 'piece' | 'botte'

const UNITE_QUANTITE_PAR_RENDEMENT: Record<UniteRendement, UniteQuantite> = {
  kg_m2: 'kg',
  kg_arbre: 'kg',
  biomasse_t_ha: 'kg',
  tiges_m2: 'tige',
  pieces_m2: 'piece',
  bottes_m2: 'botte',
}

const LIBELLE_QUANTITE: Record<UniteQuantite, { un: string; plusieurs: string }> = {
  kg: { un: 'kg', plusieurs: 'kg' },
  tige: { un: 'tige', plusieurs: 'tiges' },
  piece: { un: 'pièce', plusieurs: 'pièces' },
  botte: { un: 'botte', plusieurs: 'bottes' },
}

/**
 * Unité de quantité d'une espèce. Une unité absente ou hors canon compte des
 * kilos, comme le défaut du schéma : une ligne héritée reste lue comme avant.
 */
export function uniteQuantiteRecolte(
  uniteRendement: string | null | undefined,
): UniteQuantite {
  return UNITE_QUANTITE_PAR_RENDEMENT[(uniteRendement ?? 'kg_m2') as UniteRendement] ?? 'kg'
}

/** Libellé d'une unité de quantité, accordé au nombre. */
export function libelleUniteQuantite(unite: UniteQuantite, nombre = 2): string {
  const libelle = LIBELLE_QUANTITE[unite] ?? LIBELLE_QUANTITE.kg
  return Math.abs(nombre) < 2 ? libelle.un : libelle.plusieurs
}

/** Libellé de l'unité d'un OBJECTIF annuel, dérivé de l'unité de rendement. */
export function libelleUniteObjectif(uniteRendement: string | null | undefined): string {
  return libelleUniteQuantite(uniteQuantiteRecolte(uniteRendement))
}

/**
 * Rendement ramené en kg/m², ou `null` si l'unité ne se rapporte pas à une
 * surface.
 *
 * `kg_arbre` n'est PAS convertible : il faudrait un nombre d'arbres, que la
 * planche ne porte pas. Les fruitiers relèvent du module Verger, qui compte
 * ses arbres ; les rattacher à une projection surfacique reviendrait à
 * inventer une densité.
 */
export function rendementKgParM2(
  rendement: number | null | undefined,
  uniteRendement: string | null | undefined,
): number | null {
  if (rendement == null || !Number.isFinite(rendement) || rendement <= 0) return null

  switch (uniteRendement ?? 'kg_m2') {
    case 'kg_arbre':
      return null
    // Un rendement en tiges, pièces ou bottes ne se convertit PAS en kilos : il
    // faudrait un poids unitaire que le référentiel ne porte pas, et l'inventer
    // ferait entrer 1 300 tiges de dahlia dans un total de kilos. Ces unités
    // sont surfaciques mais non pondérales : `rendementParM2` les rend, celle-ci
    // les refuse. C'est ce refus qui garde honnêtes les totaux en kg déjà en
    // place (KPI, graphique mensuel, planification, assistant).
    case 'tiges_m2':
    case 'pieces_m2':
    case 'bottes_m2':
      return null
    case 'biomasse_t_ha':
      // 1 t/ha = 1 000 kg / 10 000 m² = 0,1 kg/m².
      return rendement / 10
    case 'kg_m2':
    default:
      // Une unité inconnue est traitée comme le défaut du schéma plutôt que
      // rejetée : une ligne héritée sans unité reste projetée comme avant.
      return rendement
  }
}

/**
 * Rendement ramené au m² DANS SON UNITÉ (kg, tiges, pièces ou bottes), ou
 * `null` quand il ne se rapporte pas à une surface (`kg_arbre`).
 *
 * C'est la version générale de `rendementKgParM2`, qui n'en est plus que la
 * projection sur les kilos.
 */
export function rendementParM2(
  rendement: number | null | undefined,
  uniteRendement: string | null | undefined,
): number | null {
  if (rendement == null || !Number.isFinite(rendement) || rendement <= 0) return null
  switch (uniteRendement ?? 'kg_m2') {
    case 'kg_arbre':
      return null
    case 'biomasse_t_ha':
      return rendement / 10
    default:
      return rendement
  }
}

/**
 * Kilos attendus d'une culture occupant `surfaceM2`.
 *
 * Rend 0 — et non un chiffre inventé — quand le rendement est absent ou non
 * surfacique. C'est déjà la convention appliquée aux espèces sans rendement :
 * la surface reste comptée, la quantité vaut zéro.
 */
export function projectionRecolteKg(
  surfaceM2: number,
  rendement: number | null | undefined,
  uniteRendement: string | null | undefined,
): number {
  if (!Number.isFinite(surfaceM2) || surfaceM2 <= 0) return 0
  const kgM2 = rendementKgParM2(rendement, uniteRendement)
  return kgM2 === null ? 0 : surfaceM2 * kgM2
}

/**
 * Quantité attendue d'une culture occupant `surfaceM2`, AVEC son unité.
 *
 * À préférer à `projectionRecolteKg` partout où la quantité est affichée : une
 * production en tiges ou en bottes y rend son vrai chiffre au lieu de zéro.
 * Les agrégats qui totalisent des kilos, eux, doivent continuer à passer par
 * la version kg — additionner des unités différentes est le défaut que cette
 * distinction existe pour empêcher.
 */
export function projectionRecolte(
  surfaceM2: number,
  rendement: number | null | undefined,
  uniteRendement: string | null | undefined,
): { quantite: number; unite: UniteQuantite } {
  const unite = uniteQuantiteRecolte(uniteRendement)
  if (!Number.isFinite(surfaceM2) || surfaceM2 <= 0) return { quantite: 0, unite }
  const parM2 = rendementParM2(rendement, uniteRendement)
  return { quantite: parM2 === null ? 0 : surfaceM2 * parM2, unite }
}
