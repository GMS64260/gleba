/** Helpers partagés par la matrice de pollinisation du verger et ses alertes. */

/**
 * Bug cmp8sk552 (Marc 2026-05-16) — Variétés connues comme auto-fertiles
 * ou partiellement auto-fertiles. Référentiel utilisé en fallback quand
 * le flag `Arbre.autofertile` n'est pas explicitement renseigné, pour
 * éviter de classer Mirabelle de Nancy ou Reine-Claude d'Oullins parmi
 * les "sans pollinisateur" alors qu'elles produisent en pollinisation
 * propre. Sources : INRAE, CTIFL, fiches Pépinières.
 */
const VARIETES_AUTOFERTILES_PATTERNS = [
  // Pruniers
  "mirabelle de nancy",
  "mirabelle de metz",
  "reine-claude d'oullins",
  "reine-claude d'althan",
  "quetsche d'alsace",
  // Pêchers
  "pêcher", // la plupart des pêchers sont auto-fertiles
  "redhaven",
  "reine des vergers",
  // Abricotiers
  "polonais",
  "bergeron",
  "luizet",
  // Cerisiers
  "stella",
  "sunburst",
  "lapins",
  // Pommiers
  "reinette grise",
  // Poiriers
  // Bug feedback testeur 2026-05-26 (cmpm6ysul) — Williams et Conférence
  // sont PARTIELLEMENT autofertiles : nécessitent un pollinisateur pour
  // un rendement correct. Sortis du fallback "autofertile=true" pour ne
  // pas induire en erreur ("plant seul = OK") alors qu'il faut associer.
  // Idem Golden Delicious (partiel) — retiré pour la même raison.
  // Figuiers (presque tous)
  "brown turkey",
  "violette de bordeaux",
  "ronde de bordeaux",
  // Petits fruits / vivaces
  "framboisier",
  "myrtille",
  "groseillier",
  "cassissier",
  "rhubarbe",
]

export function isAutofertileFallback(variete: string | null | undefined): boolean {
  if (!variete) return false
  const n = variete.toLowerCase().trim()
  return VARIETES_AUTOFERTILES_PATTERNS.some((p) => n.includes(p))
}

/**
 * Le mode de transport du pollen ne remplace jamais un pollinisateur
 * variétal compatible. Une espèce anémophile (noyer, noisetier...) doit
 * donc être signalée comme les autres si elle n'est pas autofertile et
 * qu'aucun pollinisateur explicite ou dérivé n'est disponible.
 */
export function doitSignalerSansPollinisateur({
  autofertile,
  nombrePollinisateursExplicites,
  hasPollinisateurDerive,
}: {
  autofertile: boolean
  nombrePollinisateursExplicites: number
  hasPollinisateurDerive: boolean
  modePollinisation?: string | null
}): boolean {
  return !autofertile && nombrePollinisateursExplicites === 0 && !hasPollinisateurDerive
}
