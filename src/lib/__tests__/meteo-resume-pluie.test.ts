import { describe, expect, it } from 'vitest'
import { resumerPluie } from '@/lib/meteo'

const j = (precipitation: number, precipitationInconnue = false) => ({ precipitation, ...(precipitationInconnue ? { precipitationInconnue } : {}) })

describe('résumé de pluie sur une archive incomplète', () => {
  it('ignore les jours que l’archive n’a pas encore publiés', () => {
    // Orage il y a trois jours (22 mm), puis deux jours non publiés.
    const historique = [j(0), j(0.4), j(0), j(0), j(22), j(0, true), j(0, true)]
    expect(resumerPluie(historique)).toEqual({ total7j: 22.4, joursSansPluie: 0, joursMesures: 5 })
  })

  it('compte les jours secs depuis le dernier jour mesuré', () => {
    expect(resumerPluie([j(12), j(0), j(0.5), j(0, true)])).toEqual({ total7j: 12.5, joursSansPluie: 2, joursMesures: 3 })
    expect(resumerPluie([j(0), j(0), j(0)])).toEqual({ total7j: 0, joursSansPluie: 3, joursMesures: 3 })
  })

  it('ne conclut rien sans aucun jour mesuré', () => {
    expect(resumerPluie([j(0, true), j(0, true)])).toEqual({ total7j: 0, joursSansPluie: 0, joursMesures: 0 })
  })
})
