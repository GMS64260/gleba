/**
 * QA Camille 2026-05-15 — Bug #6 : calcul du comparatif N vs N-1 pour
 * la carte "Revenus" du dashboard /comptabilite.
 *
 * Logique : on ne renvoie plus un booléen `hasComparatif` opaque (dont
 * la règle "N-1 ≥ 100 €" cachait les premiers exercices à 0 €), mais un
 * `state` à plusieurs valeurs explicites :
 *
 *   - "compare"         : revenus N-1 > 0 → pourcentage classique
 *   - "nouveau"         : revenus N-1 = 0 ET AUCUNE dépense N-1 → première
 *                         année d'activité (rien en N-1)
 *   - "nouveau-revenus" : revenus N-1 = 0 MAIS dépenses N-1 > 0 → il y a
 *                         bien eu de l'activité en N-1 (charges engagées,
 *                         ex. achat de lot), simplement pas de revenus
 *   - "vide"            : revenus N = 0 ET revenus N-1 = 0 ET dépenses
 *                         N-1 = 0 → ni en N, ni en N-1
 *
 * Bug COMPTA #2 (2026-05-31) — Avant, l'état "nouveau" affichait « pas
 * d'activité en N-1 » en ne regardant QUE les revenus. C'était faux dès
 * qu'une dépense existait en N-1 (ex. « Achat lot Solognote » 3 300 € en
 * 2025). On introduit "nouveau-revenus" pour ne plus mentir : le libellé
 * « pas d'activité en N-1 » n'apparaît plus que si N-1 est réellement vide
 * (ni revenus, ni dépenses).
 *
 * Cas "indisponible" (utilisateur inscrit après N-1 et donc aucune
 * donnée historique possible) : à brancher quand le backend exposera
 * un flag `previousYearAvailable`.
 */

export type YearDiffState = "compare" | "nouveau" | "nouveau-revenus" | "vide"

export interface YearDiff {
  state: YearDiffState
  diff: number                  // current - previous (revenus)
  percent: number               // 0 sauf si state === "compare"
  depensesPrecedente: number    // dépenses N-1 (info pour le libellé)
}

export interface StatsCompta {
  revenus?: number | null
  revenusAnneePrecedente?: number | null
  // Bug COMPTA #2 — on a besoin des dépenses N-1 pour distinguer
  // "vraiment rien en N-1" de "des dépenses mais pas de revenus".
  depensesAnneePrecedente?: number | null
}

export function computeYearDiff(stats: StatsCompta | null | undefined): YearDiff {
  if (!stats) {
    return { state: "vide", diff: 0, percent: 0, depensesPrecedente: 0 }
  }
  const current = stats.revenus ?? 0
  const previous = stats.revenusAnneePrecedente ?? 0
  const previousDepenses = stats.depensesAnneePrecedente ?? 0
  const diff = current - previous

  if (previous > 0) {
    return {
      state: "compare",
      diff,
      percent: Math.round((diff / previous) * 100),
      depensesPrecedente: previousDepenses,
    }
  }

  // Revenus N-1 = 0. Distinguer selon l'existence (ou non) de dépenses N-1.
  if (previousDepenses > 0) {
    // Il y a bien eu de l'activité en N-1 (dépenses), juste pas de revenus.
    return { state: "nouveau-revenus", diff, percent: 0, depensesPrecedente: previousDepenses }
  }

  if (current > 0) {
    return { state: "nouveau", diff, percent: 0, depensesPrecedente: 0 }
  }
  return { state: "vide", diff: 0, percent: 0, depensesPrecedente: 0 }
}
