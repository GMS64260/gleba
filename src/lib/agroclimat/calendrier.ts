/**
 * Calendrier fixe de 366 cases pour les séries climatiques quotidiennes.
 *
 * Une année est rangée dans un tableau de 366 valeurs, toujours au format d'une
 * année bissextile : la case 59 est le 29 février, vide les années communes.
 * Ainsi un même indice désigne la même date civile d'une année à l'autre (le
 * 1er mai est toujours la case 121), ce qui permet de comparer directement les
 * années entre elles.
 */

/** Nombre de cases d'une année rangée. */
export const CASES_ANNEE = 366

const JOURS_MOIS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const DEBUT_MOIS: number[] = []
{
  let cumul = 0
  for (const n of JOURS_MOIS) {
    DEBUT_MOIS.push(cumul)
    cumul += n
  }
}

export function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0
}

/** Case (0 à 365) d'un jour donné par son mois (1 à 12) et son quantième. */
export function caseDuJour(mois: number, jour: number): number {
  return DEBUT_MOIS[mois - 1] + jour - 1
}

/** Mois (1 à 12) et quantième d'une case. */
export function jourDeLaCase(index: number): { mois: number; jour: number } {
  let mois = 11
  while (mois > 0 && DEBUT_MOIS[mois] > index) mois--
  return { mois: mois + 1, jour: index - DEBUT_MOIS[mois] + 1 }
}

/** Vrai pour la case du 29 février d'une année commune (jour inexistant). */
export function caseInexistante(annee: number, index: number): boolean {
  return index === 59 && !estBissextile(annee)
}

/**
 * Rang du jour dans l'année réelle (1 à 365 ou 366), celui qu'attendent les
 * formules astronomiques.
 */
export function rangDansAnnee(annee: number, index: number): number {
  return index >= 60 && !estBissextile(annee) ? index : index + 1
}

/** « AAAA-MM-JJ » d'une case, pour une année donnée. */
export function isoDeLaCase(annee: number, index: number): string {
  const { mois, jour } = jourDeLaCase(index)
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`
}
