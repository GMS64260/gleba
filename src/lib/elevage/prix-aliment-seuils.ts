/**
 * QA Julien 2026-05-15 — Bug #12 : garde-fou sur le prix d'un aliment
 * pour bloquer les saisies aberrantes (Julien a saisi 22 €/kg pour
 * des granulés agneau, ordre de grandeur attendu ≈ 0,40-0,80 €/kg).
 *
 * Seuils définis par catégorie. Volontairement larges pour ne pas
 * gêner les éleveurs qui achètent du complément technique cher, mais
 * suffisants pour repérer un facteur ×10 à ×30 (typique d'une virgule
 * oubliée ou d'un €/sac saisi à la place du €/kg).
 *
 * Sources d'ordres de grandeur : ITAB Filières herbivores, FranceAgriMer
 * "Le marché des aliments composés" 2024, mercuriales coopératives FNAB.
 *
 * Validation non bloquante : on retourne un avertissement, l'éleveur
 * confirme avec un dialog (variant="warning"). Si pas de catégorie
 * connue → pas de seuil, pas d'avertissement.
 */

export type CategorieAliment =
  | "granules"
  | "cereales"
  | "foin"
  | "paille"
  | "complement"
  | "autre"
  | null

/** Plafond €/kg "raisonnable" par catégorie. Au-dessus → avertissement. */
const SEUILS_PRIX_KG: Record<NonNullable<Exclude<CategorieAliment, "autre">>, number> = {
  granules: 2.0,    // max usuel granulés ≈ 0,9 €/kg, on tolère 2× la fourchette haute
  cereales: 1.0,    // blé/maïs/orge : 0,25-0,45 €/kg en filière conventionnelle
  foin: 0.5,        // foin botté : 0,12-0,30 €/kg ; on tolère foin bio premium à 0,5
  paille: 0.5,
  complement: 5.0,  // CMV / oligo-élements peuvent légitimement coûter 3-4 €/kg
}

export interface PrixCheckResult {
  ok: boolean
  /** Seuil dépassé (€/kg). null si catégorie inconnue. */
  seuil: number | null
  /** Message FR prêt pour l'UI (vide si ok). */
  message: string
}

/**
 * Vérifie un prix saisi. `categorie` peut être null (cas migration ou
 * aliment historique sans catégorie) → on ne déclenche pas d'alerte.
 *
 * Renvoie aussi `ok=false` pour les prix négatifs ou zéro : bloquant
 * côté UI (validation form classique).
 */
export function verifierPrixAliment(
  prix: number | null | undefined,
  categorie: CategorieAliment
): PrixCheckResult {
  if (prix == null || prix <= 0) {
    return { ok: false, seuil: null, message: "Le prix doit être supérieur à 0 €/kg." }
  }
  if (!categorie || categorie === "autre") {
    return { ok: true, seuil: null, message: "" }
  }
  const seuil = SEUILS_PRIX_KG[categorie]
  if (!seuil) return { ok: true, seuil: null, message: "" }
  if (prix <= seuil) {
    return { ok: true, seuil, message: "" }
  }
  return {
    ok: false,
    seuil,
    message: `Prix inhabituellement élevé pour cette catégorie (${prix.toFixed(2)} €/kg ; ordre de grandeur attendu ≤ ${seuil.toFixed(2)} €/kg). Confirmez-vous ?`,
  }
}

/** Helper pour la migration data : qualifie un aliment comme hors-norme. */
export function estPrixHorsNorme(
  prix: number | null | undefined,
  categorie: CategorieAliment
): boolean {
  const r = verifierPrixAliment(prix, categorie)
  return !r.ok && r.seuil !== null
}
