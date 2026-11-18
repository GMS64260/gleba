import { describe, expect, it } from 'vitest'
import { calculerStatsInterventions } from './stats'

describe('calculerStatsInterventions', () => {
  it('rend des statistiques nulles pour un registre vide', () => {
    expect(calculerStatsInterventions([])).toEqual({
      total: 0, heuresTravaillees: 0, heuresPlanifiees: 0, coutTotal: 0, planifiees: 0,
    })
  })

  it('garde une personne par défaut et accepte les durées et coûts non renseignés', () => {
    expect(calculerStatsInterventions([
      { fait: true, dureeMinutes: 90, nbPersonnes: null, coutTotal: null },
      { fait: false, dureeMinutes: 30, nbPersonnes: null, coutTotal: 12 },
      { fait: false, dureeMinutes: null, nbPersonnes: 3, coutTotal: null },
    ])).toEqual({
      total: 3, heuresTravaillees: 1.5, heuresPlanifiees: 0.5, coutTotal: 0, planifiees: 2,
    })
  })
})
