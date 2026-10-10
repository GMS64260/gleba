/**
 * Libellés du statut d'une récolte d'arbre (`RecolteArbre.statut`).
 *
 * Ticket cmv292iae (QA 2026-10-10) — l'onglet Récoltes de la fiche arbre
 * affichait le code brut « en_stock ». Une seule table de libellés pour la
 * fiche arbre et l'onglet Productions du verger.
 */

export const STATUT_RECOLTE_ARBRE_LABELS: Record<string, string> = {
  en_stock: "En stock",
  vendu: "Vendu",
  consomme: "Usage interne",
  perte: "Perte",
}

/** Libellé lisible ; un statut absent vaut « En stock » (défaut du schéma). */
export function labelStatutRecolteArbre(statut: string | null | undefined): string {
  const code = (statut ?? "").trim() || "en_stock"
  return STATUT_RECOLTE_ARBRE_LABELS[code] ?? code.replace(/_/g, " ")
}
