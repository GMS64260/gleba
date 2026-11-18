/**
 * Numérotation des étapes d'un plan de rotation (`RotationDetail.annee`,
 * position 1..n dans le cycle).
 *
 * Revue du 2026-11-11 — les formulaires affichent « Année {rang} » mais
 * envoyaient l'`annee` portée par chaque ligne : retirer l'année 1 d'un plan
 * de trois ans puis en ajouter une envoyait [2, 3, 3]. Le serveur l'acceptait,
 * et le cycle perdait son étape 1 pendant que deux itinéraires se disputaient
 * l'étape 3 (la dernière lue l'emportait dans la vérification de rotation).
 */

/** Étapes numérotées par leur rang, telles que le formulaire les affiche. */
export function renumeroterEtapes<T extends { annee: number }>(etapes: readonly T[]): T[] {
  return etapes.map((etape, rang) => ({ ...etape, annee: rang + 1 }))
}

/** Années portées par plus d'une étape, triées ; vide si le plan est sain. */
export function anneesEnDouble(etapes: readonly { annee: number }[] | null | undefined): number[] {
  const vues = new Set<number>()
  const doubles = new Set<number>()
  for (const { annee } of etapes ?? []) {
    if (vues.has(annee)) doubles.add(annee)
    else vues.add(annee)
  }
  return [...doubles].sort((a, b) => a - b)
}

export function messageAnneesEnDouble(doubles: readonly number[]): string {
  return doubles.length > 1
    ? `Les années ${doubles.join(', ')} figurent plusieurs fois dans le plan : chaque année du cycle ne porte qu'une étape.`
    : `L'année ${doubles[0]} figure plusieurs fois dans le plan : chaque année du cycle ne porte qu'une étape.`
}
