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

/** Valeur telle que la garde une colonne à deux décimales. */
export const auCentime = (n: number) => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100

/**
 * Montant HT d'une paie : (litres/1000) × prix base + prime − pénalité.
 * Chaque terme est arrondi au centime AVANT le calcul, comme il est stocké :
 * calculé sur les saisies brutes, le total différait de la somme de ses
 * montants relus (85,998 arrondi à 86,00 pour 85 + 2,34 − 1,35, D189).
 */
export function montantPaie(litres: number, prixBaseMille: number, prime = 0, penalite = 0): number {
  const base = (auCentime(litres) / 1000) * auCentime(prixBaseMille)
  return auCentime(auCentime(base) + auCentime(prime) - auCentime(penalite))
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

type LivraisonQualite = {
  litres: number | string
  tb?: number | string | null
  tp?: number | string | null
  cellules?: number | string | null
  germes?: number | string | null
}

/**
 * Qualité moyenne d'un ensemble de livraisons, pondérée par le volume.
 *
 * Un taux est une grandeur du lait livré : 3 L à TB 40 et 97 L à TB 60 font
 * un lait à 59,4, pas à 50. La moyenne simple donnait le même poids aux deux
 * livraisons et faussait la prime estimée (équipe debug, D99). Chaque taux est
 * moyenné sur les seules livraisons qui le renseignent ; `null` si aucune.
 */
export function qualiteLivraisonsPonderee(livraisons: LivraisonQualite[]): Required<QualiteLait> {
  const moyenne = (cle: 'tb' | 'tp' | 'cellules' | 'germes'): number | null => {
    let somme = 0
    let volume = 0
    for (const l of livraisons) {
      const brut = l[cle]
      if (brut === null || brut === undefined || brut === '') continue
      const taux = Number(brut)
      const litres = Number(l.litres)
      if (!Number.isFinite(taux) || !Number.isFinite(litres) || litres <= 0) continue
      somme += taux * litres
      volume += litres
    }
    return volume > 0 ? somme / volume : null
  }
  return { tb: moyenne('tb'), tp: moyenne('tp'), cellules: moyenne('cellules'), germes: moyenne('germes') }
}
