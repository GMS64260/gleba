/**
 * QA Camille 2026-05-15 — Bug #6 : calcul du comparatif N vs N-1 pour
 * la carte "Revenus" du dashboard /comptabilite.
 *
 * Logique : on ne renvoie plus un booléen `hasComparatif` opaque (dont
 * la règle "N-1 ≥ 100 €" cachait les premiers exercices à 0 €), mais un
 * `state` à 3 valeurs explicites :
 *
 *   - "compare" : N-1 > 0 → pourcentage classique
 *   - "nouveau" : N-1 = 0 ET N > 0 → première année avec activité
 *   - "vide"    : N-1 = 0 ET N = 0 → ni en N, ni en N-1
 *
 * Cas "indisponible" (utilisateur inscrit après N-1 et donc aucune
 * donnée historique possible) : à brancher quand le backend exposera
 * un flag `previousYearAvailable` — aujourd'hui on ne sait pas
 * distinguer "0 € parce que rien" de "0 € parce que pré-inscription",
 * on garde "vide" qui couvre les deux honnêtement.
 */

export type YearDiffState = "compare" | "nouveau" | "vide"

export interface YearDiff {
  state: YearDiffState
  diff: number           // current - previous
  percent: number        // 0 sauf si state === "compare"
}

export interface StatsCompta {
  revenus?: number | null
  revenusAnneePrecedente?: number | null
}

export function computeYearDiff(stats: StatsCompta | null | undefined): YearDiff {
  if (!stats) {
    return { state: "vide", diff: 0, percent: 0 }
  }
  const current = stats.revenus ?? 0
  const previous = stats.revenusAnneePrecedente ?? 0
  const diff = current - previous

  if (previous > 0) {
    return {
      state: "compare",
      diff,
      percent: Math.round((diff / previous) * 100),
    }
  }
  if (current > 0) {
    return { state: "nouveau", diff, percent: 0 }
  }
  return { state: "vide", diff: 0, percent: 0 }
}
