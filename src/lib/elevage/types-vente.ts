/**
 * Libellés des types de vente de produits d'élevage (`VenteProduit.type`).
 *
 * Source unique pour l'onglet Production > Ventes, la page Économie de
 * l'élevage et les catégories de ventes du tableau de bord
 * (`dashboard-productions.ts`). QA cmv5jxvcy (2026-10-12) : la page Économie fabriquait son
 * libellé d'atelier depuis la clé technique (« Ventes oeufs ») alors que
 * l'onglet Ventes affichait « Œufs ».
 */
export const TYPES_VENTE_LABELS: Record<string, string> = {
  oeufs: "Œufs",
  viande: "Viande",
  animal_vivant: "Animal vivant",
  lait: "Lait",
  fromage: "Fromage",
  miel: "Miel",
  cire: "Cire",
  propolis: "Propolis",
  pollen: "Pollen",
  gelee_royale: "Gelée royale",
  autre_ruche: "Autre produit de la ruche",
  autre: "Autre",
}

/** Libellé affichable d'un type de vente ; clé inconnue rendue lisible (« laine_brute » → « Laine brute »). */
export function libelleTypeVente(type: string): string {
  return (
    TYPES_VENTE_LABELS[type]
    ?? type.replaceAll("_", " ").replace(/^./u, (lettre) => lettre.toLocaleUpperCase("fr-FR"))
  )
}

/** Nom de l'atelier « Ventes <type> » de la page Économie (ex. « Ventes œufs »). */
export function libelleAtelierVentes(type: string): string {
  return `Ventes ${libelleTypeVente(type).toLocaleLowerCase("fr-FR")}`
}
