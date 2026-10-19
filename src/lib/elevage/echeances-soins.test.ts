/**
 * QA 2026-10-19 — « 3 soins prévus dans les 30 prochains jours » pour deux
 * retards (19/08, 24/08) et un seul soin à venir (26/10), au 19/10/2026.
 */
import { describe, expect, it } from 'vitest'
import {
  classerEcheanceSoin,
  compterEcheancesSoins,
  echeanceSoinAFaire,
  joursAvantEcheance,
  jourCivil,
  trierParEcheanceSoin,
} from './echeances-soins'

const AUJOURDHUI = '2026-10-19'

describe('échéance d’un soin à faire', () => {
  it('classe le retard, aujourd’hui, J+30 inclus et J+31 exclu', () => {
    expect(classerEcheanceSoin('2026-10-18', AUJOURDHUI)).toBe('en_retard')
    expect(classerEcheanceSoin('2026-10-19', AUJOURDHUI)).toBe('a_venir')
    expect(classerEcheanceSoin('2026-11-18', AUJOURDHUI)).toBe('a_venir') // J+30
    expect(classerEcheanceSoin('2026-11-19', AUJOURDHUI)).toBe('au_dela') // J+31
  })

  it('lit une date horodatée par son jour local, quelle que soit l’heure', () => {
    expect(jourCivil(new Date(2026, 9, 19, 0, 5))).toBe('2026-10-19')
    expect(jourCivil(new Date(2026, 9, 19, 23, 55))).toBe('2026-10-19')
    expect(classerEcheanceSoin(new Date(2026, 9, 19, 23, 55), AUJOURDHUI)).toBe('a_venir')
    expect(classerEcheanceSoin(new Date(2026, 9, 18, 23, 55), AUJOURDHUI)).toBe('en_retard')
    expect(joursAvantEcheance(new Date(2026, 10, 18, 12), AUJOURDHUI)).toBe(30)
  })

  it('ignore une échéance absente ou invalide', () => {
    expect(classerEcheanceSoin(null, AUJOURDHUI)).toBeNull()
    expect(classerEcheanceSoin('pas une date', AUJOURDHUI)).toBeNull()
  })

  it('prend la date prévue, sinon la date du soin', () => {
    expect(echeanceSoinAFaire({ datePrevue: '2026-10-26', date: '2026-03-15' })).toBe('2026-10-26')
    expect(echeanceSoinAFaire({ datePrevue: null, date: '2026-03-15' })).toBe('2026-03-15')
  })

  it('compte séparément retards et soins à venir (cas du signalement)', () => {
    expect(compterEcheancesSoins(['2026-08-19', '2026-08-24', '2026-10-26'], AUJOURDHUI)).toEqual({
      total: 3,
      enRetard: 2,
      aVenir: 1,
      auDela: 0,
      horizonJours: 30,
    })
  })

  it('le total garde les lignes au-delà de l’horizon ou sans échéance', () => {
    const compte = compterEcheancesSoins(['2026-12-01', null, '2026-10-19'], AUJOURDHUI)
    expect(compte).toMatchObject({ total: 3, enRetard: 0, aVenir: 1, auDela: 1 })
  })

  it('trie par échéance, les plus en retard d’abord, sans échéance en dernier', () => {
    const soins = [
      { id: 'a', datePrevue: '2026-10-26', date: '2026-10-01' },
      { id: 'b', datePrevue: null, date: '2026-08-24' },
      { id: 'c', datePrevue: null, date: null },
      { id: 'd', datePrevue: '2026-08-19', date: '2026-08-19' },
    ]
    expect(trierParEcheanceSoin(soins).map((s) => s.id)).toEqual(['d', 'b', 'a', 'c'])
  })
})
