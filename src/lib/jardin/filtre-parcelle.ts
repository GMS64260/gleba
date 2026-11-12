/**
 * Filtre de parcelle du plan (/jardin) : un id de parcelle, `null` pour
 * « Toutes les parcelles », ou la sentinelle `'none'` pour « Non assigné »
 * (les éléments sans parcelle). La sentinelle sert aux lectures
 * (`?parcelle=none`), jamais d'id de parcelle à l'écriture.
 */
export const FILTRE_SANS_PARCELLE = "none"

/**
 * Parcelle à transmettre à la création d'un objet ou d'un arbre depuis le
 * filtre courant : l'id choisi, sinon `undefined` (aucune parcelle imposée).
 * PLAN-02 (revue Codex du 2026-11-12) : `filtre || undefined` envoyait 'none',
 * et la route répondait 400 ou 404 en cherchant une parcelle d'id 'none'.
 */
export function parcelleDeCreation(filtre: string | null | undefined): string | undefined {
  if (!filtre || filtre === FILTRE_SANS_PARCELLE) return undefined
  return filtre
}
