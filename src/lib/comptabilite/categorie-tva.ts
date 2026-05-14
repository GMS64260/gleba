/**
 * Mapping catégorie → taux TVA par défaut.
 * Utilisé pour la présélection du taux à la saisie d'une vente/dépense,
 * et pour l'inférence rétroactive des transactions historiques en migration.
 *
 * Sources : BOFIP / art. 278 et 278-0 bis CGI.
 *  - 5.5 % : produits agricoles destinés à l'alimentation humaine (légumes, fruits,
 *    œufs, viandes vendues fraîches/transformées artisanalement par l'éleveur)
 *  - 10 %  : animaux vivants destinés à la boucherie/charcuterie, intrants agricoles
 *    (aliments, semences, plants), travaux agricoles
 *  - 20 %  : matériel, carburant, services non agricoles, bois, prestations
 *  -  0 %  : main-d'œuvre interne, dons, opérations hors champ TVA
 */

export const VENTE_CATEGORIE_TAUX: Record<string, number> = {
  legumes: 5.5,
  fruits: 5.5,
  oeufs: 5.5,
  transformation: 5.5,
  viande: 5.5,
  produits_transformes: 5.5,
  // Animaux vivants : 10 %
  animaux_vivants: 10,
  // Services agricoles & prestations : 20 % par défaut
  service: 20,
  prestation: 20,
  bois: 20,
  autre: 20,
}

export const DEPENSE_CATEGORIE_TAUX: Record<string, number> = {
  // Intrants agricoles à 10 %
  semences: 10,
  plants: 10,
  aliments: 10,
  aliments_animaux: 10,
  animaux: 10,
  travaux_agricoles: 10,
  // Matériel, carburant, abonnements, services à 20 %
  materiel: 20,
  carburant: 20,
  abonnement: 20,
  prestation: 20,
  veterinaire: 20,
  // Main-d'œuvre interne et frais hors champ TVA
  main_oeuvre: 0,
  msa: 0,
  cotisations: 0,
  // Autre par défaut 20 %
  autre: 20,
}

export function tauxTvaPourVente(categorie: string | null | undefined): number {
  if (!categorie) return 5.5
  return VENTE_CATEGORIE_TAUX[categorie] ?? 5.5
}

export function tauxTvaPourDepense(categorie: string | null | undefined): number {
  if (!categorie) return 20
  return DEPENSE_CATEGORIE_TAUX[categorie] ?? 20
}

/** Recalcule HT/TVA à partir du TTC et du taux. */
export function recalculTvaTtc(ttc: number, taux: number): { ht: number; tva: number } {
  const ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100
  const tva = Math.round((ttc - ht) * 100) / 100
  return { ht, tva }
}
