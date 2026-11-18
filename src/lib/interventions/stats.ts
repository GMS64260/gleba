/** Champs communs aux interventions saisies et aux entrées des autres modules. */
interface EntreeStatsIntervention {
  fait: boolean
  dureeMinutes: number | null
  nbPersonnes: number | null
  coutTotal: number | null
}

export interface StatsInterventions {
  total: number
  heuresTravaillees: number
  heuresPlanifiees: number
  coutTotal: number
  planifiees: number
}

/**
 * Agrège le registre déjà cloisonné et filtré par l'appelant.
 * Les durées sont des heures-personnes ; seul le réalisé contribue au coût.
 */
export function calculerStatsInterventions(
  entrees: readonly EntreeStatsIntervention[],
): StatsInterventions {
  let minutesTravaillees = 0
  let minutesPlanifiees = 0
  let coutTotal = 0
  let planifiees = 0

  for (const entree of entrees) {
    const minutesPersonnes = (entree.dureeMinutes || 0) * (entree.nbPersonnes || 1)
    if (entree.fait) {
      minutesTravaillees += minutesPersonnes
      coutTotal += entree.coutTotal || 0
    } else {
      minutesPlanifiees += minutesPersonnes
      planifiees += 1
    }
  }

  return {
    total: entrees.length,
    heuresTravaillees: minutesTravaillees / 60,
    heuresPlanifiees: minutesPlanifiees / 60,
    coutTotal,
    planifiees,
  }
}
