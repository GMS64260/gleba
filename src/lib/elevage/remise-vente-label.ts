/**
 * Libellé compact des dates de remise en vente après un traitement.
 *
 * Le lait, les œufs et la viande ont chacun leur délai de retrait. Les vues
 * concaténaient ces volets à la main avec un séparateur conditionnel, ce qui
 * ne tient pas à trois volets (QA 2026-07-30 : le délai œufs n'existait pas).
 */

export type RemisesEnVente = {
  lait?: string | Date | null
  oeufs?: string | Date | null
  viande?: string | Date | null
}

const jour = (valeur: string | Date) =>
  (valeur instanceof Date ? valeur : new Date(valeur)).toLocaleDateString("fr-FR")

/**
 * Renvoie par exemple « Œufs 04/08/2026 · Viande 15/08/2026 », ou une chaîne
 * vide s'il n'y a aucun délai actif — auquel cas la ligne ne doit pas s'afficher.
 */
export function formatRemisesEnVente(remises: RemisesEnVente): string {
  const parts: string[] = []
  if (remises.lait) parts.push(`Lait ${jour(remises.lait)}`)
  if (remises.oeufs) parts.push(`Œufs ${jour(remises.oeufs)}`)
  if (remises.viande) parts.push(`Viande ${jour(remises.viande)}`)
  return parts.join(" · ")
}
