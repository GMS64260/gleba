import { describe, expect, it } from 'vitest'

import { anneesEnDouble, messageAnneesEnDouble, renumeroterEtapes } from '../numerotation'

describe('renumeroterEtapes', () => {
  it('numérote par le rang, comme le formulaire affiche les années', () => {
    // Plan de trois ans, année 1 retirée puis une année ajoutée.
    const etapes = [
      { annee: 2, itpId: 'haricot' },
      { annee: 3, itpId: 'phacelie' },
      { annee: 3, itpId: null },
    ]
    expect(renumeroterEtapes(etapes)).toEqual([
      { annee: 1, itpId: 'haricot' },
      { annee: 2, itpId: 'phacelie' },
      { annee: 3, itpId: null },
    ])
    expect(etapes[0].annee).toBe(2)
  })

  it('laisse un plan déjà numéroté tel quel', () => {
    const etapes = [{ annee: 1, itpId: 'a' }, { annee: 2, itpId: 'b' }]
    expect(renumeroterEtapes(etapes)).toEqual(etapes)
    expect(renumeroterEtapes([])).toEqual([])
  })
})

describe('anneesEnDouble', () => {
  it('rend les années portées par plusieurs étapes', () => {
    expect(anneesEnDouble([{ annee: 2 }, { annee: 3 }, { annee: 3 }])).toEqual([3])
    expect(anneesEnDouble([{ annee: 2 }, { annee: 1 }, { annee: 2 }, { annee: 1 }, { annee: 1 }])).toEqual([1, 2])
  })

  it('ne dit rien d’un plan sain, troué ou absent', () => {
    expect(anneesEnDouble([{ annee: 1 }, { annee: 2 }])).toEqual([])
    expect(anneesEnDouble([{ annee: 1 }, { annee: 3 }])).toEqual([])
    expect(anneesEnDouble(undefined)).toEqual([])
  })

  it('nomme les années dans le message', () => {
    expect(messageAnneesEnDouble([3])).toMatch(/^L'année 3 figure plusieurs fois/)
    expect(messageAnneesEnDouble([1, 2])).toMatch(/^Les années 1, 2 figurent plusieurs fois/)
  })
})
