/**
 * Types d'arbre du verger (`arbres.type`) : source unique des listes, onglets,
 * libellés et filtres.
 *
 * Signalement QA du 2026-10-19 : le référentiel classe le kiwi en « Liane
 * fruitière » (catégorie d'espèce `liane`, 2026-10-08), mais la création d'un
 * arbre ne proposait que Fruitier, Petit fruit, Forestier, Ornemental et Haie,
 * et le champ Espèce de l'onglet Arbres n'offrait le kiwi sous aucun d'eux
 * (sa table type → catégories ignorait `liane`, contrairement à la fiche).
 * Chaque écran portait sa propre copie de la liste : la fiche, l'onglet, le
 * plan du jardin et la route n'avaient pas les mêmes valeurs.
 *
 * `arbres.type` est une colonne texte sans contrainte : ajouter `liane` ne
 * demande aucune migration. Tout ce qui énumère les types d'arbre, ou les
 * types qui produisent des fruits, passe par ce module.
 */

export const TYPES_ARBRE = [
  {
    value: "fruitier",
    label: "Fruitier",
    labelPluriel: "Fruitiers",
    // Une liane se conduisait jusqu'ici en fruitier ou en petit fruit
    // (décision du 2026-10-08) : ses espèces restent proposées sous ces deux
    // types, pour les arbres déjà saisis ainsi.
    categoriesEspece: ["arbre_fruitier", "liane"],
  },
  {
    value: "petit_fruit",
    label: "Petit fruit",
    labelPluriel: "Petits fruits",
    categoriesEspece: ["petit_fruit", "liane"],
  },
  {
    value: "liane",
    label: "Liane fruitière",
    labelPluriel: "Lianes",
    categoriesEspece: ["liane"],
  },
  { value: "forestier", label: "Forestier", labelPluriel: "Forestiers", categoriesEspece: null },
  { value: "ornement", label: "Ornemental", labelPluriel: "Ornementaux", categoriesEspece: null },
  { value: "haie", label: "Haie", labelPluriel: "Haies", categoriesEspece: null },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  labelPluriel: string
  /** Catégories d'espèce (`especes.type`) proposées dans le champ Espèce ; null = toutes celles du verger. */
  categoriesEspece: readonly string[] | null
}>

export type TypeArbre = (typeof TYPES_ARBRE)[number]["value"]

/**
 * Couleur par défaut d'un type d'arbre : pastille du plan 2D, sélecteurs du
 * plan et graphique « Répartition par type ». Un arbre peut porter sa propre
 * couleur (`arbres.couleur`).
 */
export const COULEURS_TYPES_ARBRE: Record<TypeArbre, string> = {
  fruitier: "#22c55e",
  petit_fruit: "#ef4444",
  liane: "#0d9488",
  forestier: "#15803d",
  ornement: "#a855f7",
  haie: "#84cc16",
}

export function couleurTypeArbre(type: string | null | undefined): string {
  return COULEURS_TYPES_ARBRE[(type ?? "") as TypeArbre] ?? COULEURS_TYPES_ARBRE.fruitier
}

export const VALEURS_TYPES_ARBRE: readonly TypeArbre[] = TYPES_ARBRE.map((t) => t.value)

/**
 * Types d'arbre qui produisent des fruits : pollinisation, récoltes, âge des
 * fruitiers, étiquettes, KPI « fruitiers productifs ».
 */
export const TYPES_ARBRE_FRUITIERS = ["fruitier", "petit_fruit", "liane"] as const satisfies readonly TypeArbre[]

export function estTypeArbre(valeur: unknown): valeur is TypeArbre {
  return typeof valeur === "string" && (VALEURS_TYPES_ARBRE as readonly string[]).includes(valeur)
}

export function estTypeArbreFruitier(type: string | null | undefined): boolean {
  return (TYPES_ARBRE_FRUITIERS as readonly string[]).includes(type ?? "")
}

/** Libellé d'un type d'arbre ; une valeur héritée hors liste reste visible telle quelle. */
export function libelleTypeArbre(type: string | null | undefined): string {
  if (!type) return ""
  return TYPES_ARBRE.find((t) => t.value === type)?.label ?? type
}

/**
 * Catégories d'espèce du référentiel proposées pour un type d'arbre, ou null
 * quand toutes les espèces du verger conviennent (forestier, ornemental, haie,
 * ou type inconnu).
 */
export function categoriesEspecePourTypeArbre(type: string | null | undefined): readonly string[] | null {
  return TYPES_ARBRE.find((t) => t.value === type)?.categoriesEspece ?? null
}

/**
 * Type d'arbre naturel d'une catégorie d'espèce du référentiel : sert à
 * signaler, à la création, qu'un kiwi classé « Petit fruit » serait mieux
 * rangé en « Liane fruitière ».
 */
export function typeArbrePourCategorieEspece(categorie: string | null | undefined): TypeArbre | null {
  switch (categorie) {
    case "arbre_fruitier":
      return "fruitier"
    case "petit_fruit":
      return "petit_fruit"
    case "liane":
      return "liane"
    default:
      return null
  }
}

/** Message de refus d'un type inconnu, qui nomme le champ et les valeurs admises. */
export function messageTypeArbreInvalide(valeur: unknown): string {
  return `Type d'arbre inconnu${typeof valeur === "string" && valeur.trim() ? ` (« ${valeur.trim()} »)` : ""} : choisissez ${TYPES_ARBRE.map((t) => t.label).join(", ")}.`
}
