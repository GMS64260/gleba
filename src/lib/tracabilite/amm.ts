/**
 * Numéro d'autorisation de mise sur le marché (AMM) d'un produit phyto.
 *
 * En France, un numéro d'AMM (registre E-Phy, ANSES) est composé de sept
 * chiffres (ex. 2100123, 9800203) ; les permis de commerce parallèle et les
 * produits de biocontrôle suivent le même format. Un produit non soumis à AMM
 * (substance de base, PNPP) n'a simplement pas de numéro : le champ reste vide.
 *
 * QA cmv2962ey (2026-10-10) — « ABC » était accepté comme AMM et paraissait
 * au registre sans badge « Non conforme » : le registre ne vérifiait que la
 * présence du champ, jamais sa forme. Une AMM illisible lors d'un contrôle
 * vaut une AMM absente.
 */

/** Chiffres seuls : espaces, points, tirets et préfixe « AMM » tolérés à la saisie. */
export function normaliserNumAMM(valeur: string | null | undefined): string {
  if (!valeur) return ''
  return valeur
    .trim()
    .replace(/^(n[°o]\s*)?amm\s*:?\s*/i, '')
    .replace(/[\s.\-]/g, '')
}

export function numAMMValide(valeur: string | null | undefined): boolean {
  return /^\d{7}$/.test(normaliserNumAMM(valeur))
}

export const MESSAGE_AMM_INVALIDE =
  "Numéro d'AMM invalide : sept chiffres attendus (ex. 2100123). Laissez le champ vide si le produit n'est pas soumis à AMM."
