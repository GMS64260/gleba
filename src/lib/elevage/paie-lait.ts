/**
 * Paie du lait (PROMPT 26) — fonctions pures.
 *
 * Montant d'une paie mensuelle et estimation des primes/pénalités qualité à
 * partir des taux (TB, TP) et de l'hygiène (cellules, germes). La grille est
 * indicative et propre à chaque laiterie : à ajuster dans l'UI.
 */

export type GrilleQualite = {
  refTB: number // g/L de référence
  refTP: number
  primeTBParG: number // €/1000 L par g au-dessus (ou en-dessous) de la référence
  primeTPParG: number
  seuilCellules: number // ×10³/mL au-delà duquel pénalité
  malusCellules: number // €/1000 L
  seuilGermes: number // ×10³/mL
  malusGermes: number // €/1000 L
}

// Valeurs indicatives caprin — à adapter à la grille réelle du collecteur.
export const GRILLE_DEFAUT: GrilleQualite = {
  refTB: 38,
  refTP: 30,
  primeTBParG: 2,
  primeTPParG: 4,
  seuilCellules: 1500,
  malusCellules: 20,
  seuilGermes: 500,
  malusGermes: 15,
}

/** Montant HT d'une paie : (litres/1000) × prix base + prime − pénalité. */
export function montantPaie(litres: number, prixBaseMille: number, prime = 0, penalite = 0): number {
  const base = (litres / 1000) * prixBaseMille
  return Math.round((base + prime - penalite) * 100) / 100
}

export type QualiteLait = { tb?: number | null; tp?: number | null; cellules?: number | null; germes?: number | null }

/**
 * Estime prime et pénalité qualité (en €) pour un volume donné, selon la grille.
 * Prime = (bonus TB + bonus TP) × litres/1000 (peut être négatif si sous la réf).
 * Pénalité = malus cellules + germes × litres/1000 si seuils dépassés.
 */
export function estimePrimeQualite(
  q: QualiteLait,
  litres: number,
  grille: GrilleQualite = GRILLE_DEFAUT
): { prime: number; penalite: number } {
  const mille = litres / 1000
  let primeParMille = 0
  if (q.tb != null) primeParMille += (q.tb - grille.refTB) * grille.primeTBParG
  if (q.tp != null) primeParMille += (q.tp - grille.refTP) * grille.primeTPParG

  let malusParMille = 0
  if (q.cellules != null && q.cellules > grille.seuilCellules) malusParMille += grille.malusCellules
  if (q.germes != null && q.germes > grille.seuilGermes) malusParMille += grille.malusGermes

  return {
    prime: Math.round(primeParMille * mille * 100) / 100,
    penalite: Math.round(malusParMille * mille * 100) / 100,
  }
}
