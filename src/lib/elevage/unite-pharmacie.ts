/**
 * Conversion entre unités d'un lot de pharmacie d'élevage.
 *
 * L'unité d'un lot est un texte libre. Ajouter « 1 L » à un lot tenu en mL
 * additionnait les nombres et reprenait l'unité saisie : 12,5 mL + 1 L
 * donnaient 13,5 L, registre sanitaire compris (équipe debug, D193).
 * La quantité ajoutée est convertie dans l'unité du lot, qui ne change pas ;
 * deux unités sans rapport connu (mL et flacon) ne s'additionnent pas.
 */
const UNITES: Record<string, { dimension: 'volume' | 'masse'; facteur: number }> = {
  ml: { dimension: 'volume', facteur: 1 },
  cl: { dimension: 'volume', facteur: 10 },
  dl: { dimension: 'volume', facteur: 100 },
  l: { dimension: 'volume', facteur: 1000 },
  mg: { dimension: 'masse', facteur: 1 },
  g: { dimension: 'masse', facteur: 1000 },
  kg: { dimension: 'masse', facteur: 1_000_000 },
}

const SYNONYMES: Array<[RegExp, string]> = [
  [/^millilitres?$/, 'ml'],
  [/^centilitres?$/, 'cl'],
  [/^litres?$/, 'l'],
  [/^milligrammes?$/, 'mg'],
  [/^grammes?$/, 'g'],
  [/^(kilos?|kilogrammes?)$/, 'kg'],
  [/^(cc|cm3|cm³)$/, 'ml'],
]

function cleUnite(unite: string): string {
  const brute = unite.trim().toLowerCase().replace(/\.$/, '')
  // Unité libre (« flacons », « doses », « comprimés ») : le pluriel ne fait pas une autre unité.
  return SYNONYMES.find(([motif]) => motif.test(brute))?.[1] ?? (brute in UNITES ? brute : brute.replace(/(.{3,})s$/, '$1'))
}

/** Vrai si les deux textes désignent la même unité (« mL », « ml », « millilitres »). */
export function memeUnitePharmacie(a: string, b: string): boolean {
  return cleUnite(a) === cleUnite(b)
}

/** Quantité exprimée dans l'unité `vers`, ou `null` si les unités ne se convertissent pas. */
export function convertirQuantitePharmacie(quantite: number, de: string, vers: string): number | null {
  if (memeUnitePharmacie(de, vers)) return quantite
  const source = UNITES[cleUnite(de)]
  const cible = UNITES[cleUnite(vers)]
  if (!source || !cible || source.dimension !== cible.dimension) return null
  return Math.round((quantite * source.facteur / cible.facteur) * 1e6) / 1e6
}
