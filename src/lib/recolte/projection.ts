/**
 * Projection de récolte à partir d'un rendement de référentiel.
 *
 * `Espece.rendement` est un nombre dont le SENS dépend de `Espece.uniteRendement`
 * (cf. docs/conventions.md) : kg/m², kg/arbre ou t/ha. Trois consommateurs le
 * multipliaient pourtant par une surface sans jamais lire l'unité — le Kiwi
 * (25 kg/arbre) annonçait 750 kg sur 30 m², le Tournesol (2,5 t/ha) 45 kg au
 * lieu de 4,5. Toute la projection annuelle, le KPI « Récoltes attendues » et
 * le graphique mensuel étaient faux dès qu'un fruitier ou un engrais vert
 * entrait dans le plan.
 *
 * Une seule conversion, ici, pour la planification, le tableau de bord et
 * l'agrégat KPI. Ne pas réintroduire de `surface * rendement` local.
 */

/** Unités connues de `Espece.uniteRendement`. Défaut schéma : `kg_m2`. */
export type UniteRendement = 'kg_m2' | 'kg_arbre' | 'biomasse_t_ha'

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
