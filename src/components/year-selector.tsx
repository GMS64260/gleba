/**
 * QA Camille 2026-05-15 — Bonus : sélecteur d'année factorisé.
 *
 * Avant : chaque page (page.tsx, elevage, verger, compta, interventions,
 * tracabilite, couts-production) hardcodait sa plage d'années avec des
 * formules subtilement divergentes (length 5 vs 6, ±1). Conséquences :
 *   * Maraîchage : 2021–2026
 *   * Compta    : 2022–2026
 *   * Aucun module ne proposait 2027 (planification anticipée bloquée)
 *
 * Source unique : `getAvailableYears()` propose l'année suivante et tout
 * l'historique depuis 2000, borne admise par les routes (`lireAnnee`).
 * Une fenêtre glissante à N-4 masquait les saisies anciennes (ex. 2019),
 * et aucun appelant ne disposait d'une borne issue des données complètes.
 *
 * Si tu dois élargir la plage (historique avant 2000), passe
 * `earliest` : `getAvailableYears(1995)`. `latest` permet aux rotations
 * de conserver leur horizon de planification à cinq ans.
 */

import { PREMIER_EXERCICE, dernierExercice } from "@/lib/exercices"

export function getAvailableYears(earliest?: number, latest = dernierExercice()): number[] {
  const oldest = earliest ?? PREMIER_EXERCICE
  const years: number[] = []
  for (let y = latest; y >= oldest; y--) {
    years.push(y)
  }
  return years
}
