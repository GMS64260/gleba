export const PRODUITS_RUCHE = [
  "miel",
  "cire",
  "propolis",
  "pollen",
  "gelee_royale",
  "autre",
] as const

export type ProduitRuche = (typeof PRODUITS_RUCHE)[number]

export const UNITES_PRODUITS_RUCHE = ["kg", "g"] as const
export type UniteProduitRuche = (typeof UNITES_PRODUITS_RUCHE)[number]

export const TYPES_VENTE_PRODUITS_RUCHE = [
  "miel",
  "cire",
  "propolis",
  "pollen",
  "gelee_royale",
  "autre_ruche",
] as const
export type TypeVenteProduitRuche = (typeof TYPES_VENTE_PRODUITS_RUCHE)[number]

export const PRODUITS_RUCHE_LABELS: Record<ProduitRuche, string> = {
  miel: "Miel",
  cire: "Cire",
  propolis: "Propolis",
  pollen: "Pollen",
  gelee_royale: "Gelée royale",
  autre: "Autre produit",
}

export const TYPES_VENTE_PRODUITS_RUCHE_LABELS: Record<TypeVenteProduitRuche, string> = {
  miel: "Miel",
  cire: "Cire",
  propolis: "Propolis",
  pollen: "Pollen",
  gelee_royale: "Gelée royale",
  autre_ruche: "Autre produit de la ruche",
}

export function uniteProduitRucheParDefaut(produit: ProduitRuche): UniteProduitRuche {
  return produit === "propolis" || produit === "gelee_royale" ? "g" : "kg"
}

export function typeVenteVersProduitRuche(type: string): ProduitRuche | null {
  if (type === "autre_ruche") return "autre"
  return (TYPES_VENTE_PRODUITS_RUCHE as readonly string[]).includes(type)
    ? type as ProduitRuche
    : null
}

export function estVenteProduitRuche(type: string): type is TypeVenteProduitRuche {
  return (TYPES_VENTE_PRODUITS_RUCHE as readonly string[]).includes(type)
}

/**
 * Valeur proposée à la saisie, toujours modifiable : les produits normalement
 * destinés à l'alimentation humaine sont à 5,5 %, les usages non alimentaires
 * et ambigus restent prudemment au taux normal.
 */
export function tauxTvaProduitRucheParDefaut(type: string): number {
  return type === "miel" || type === "pollen" || type === "gelee_royale" ? 5.5 : 20
}

export function tauxTvaVenteProduitParDefaut(type: string): number {
  return estVenteProduitRuche(type) ? tauxTvaProduitRucheParDefaut(type) : 5.5
}

export function estLotApicole(lot: {
  especeAnimale?: {
    id?: string | null
    nom?: string | null
    production?: string | null
    productions?: string[] | null
    categorieReglementaire?: string | null
  } | null
}): boolean {
  const espece = lot.especeAnimale
  if (!espece) return false
  const valeurs = [
    espece.id,
    espece.nom,
    espece.production,
    espece.categorieReglementaire,
    ...(espece.productions ?? []),
  ]
    .filter((valeur): valeur is string => Boolean(valeur))
    .map((valeur) => valeur.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/\p{Diacritic}/gu, ""))

  return valeurs.some((valeur) =>
    valeur.includes("abeille") ||
    valeur.includes("apiculture") ||
    valeur.includes("miel") ||
    // « ruche » en frontière de mot uniquement : « perruche » et « autruche »
    // ne doivent pas devenir des cibles apicoles.
    /\bruches?\b/.test(valeur)
  )
}
