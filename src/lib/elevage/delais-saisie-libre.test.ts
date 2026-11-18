import { describe, expect, it } from 'vitest'
import { delaisManquantsSaisieLibre, delaisRequisSaisieLibre, delaiSaisi } from './delais-saisie-libre'

describe('delaisRequisSaisieLibre (B6)', () => {
  it('exige toujours la viande, même sans cible connue', () => {
    expect(delaisRequisSaisieLibre(null)).toEqual(['viande'])
    expect(delaisRequisSaisieLibre({ especeAnimale: { type: 'mammifere_petit', production: 'viande' } })).toEqual(['viande'])
  })

  it('ajoute le lait pour une femelle ou un lot laitier, pas pour un mâle', () => {
    const chevre = { type: 'mammifere_petit', production: 'lait' }
    expect(delaisRequisSaisieLibre({ especeAnimale: chevre, sexe: 'femelle' })).toEqual(['viande', 'lait'])
    expect(delaisRequisSaisieLibre({ especeAnimale: chevre, sexe: 'inconnu' })).toEqual(['viande', 'lait'])
    expect(delaisRequisSaisieLibre({ especeAnimale: chevre })).toEqual(['viande', 'lait'])
    expect(delaisRequisSaisieLibre({ especeAnimale: chevre, sexe: 'male' })).toEqual(['viande'])
  })

  it('suit l’orientation laitière d’une brebis d’espèce non typée', () => {
    expect(delaisRequisSaisieLibre({ especeAnimale: { type: 'mammifere_petit', production: null }, sexe: 'femelle', orientationProduction: 'lait' }))
      .toEqual(['viande', 'lait'])
  })

  it('ajoute les œufs pour des pondeuses, jamais le lait', () => {
    expect(delaisRequisSaisieLibre({ especeAnimale: { type: 'volaille', production: 'oeufs' } })).toEqual(['viande', 'oeufs'])
    expect(delaisRequisSaisieLibre({ especeAnimale: { type: 'volaille', production: 'mixte' } })).toEqual(['viande', 'oeufs'])
    expect(delaisRequisSaisieLibre({ especeAnimale: { type: 'volaille', production: 'viande', productions: ['oeufs'] } })).toEqual(['viande', 'oeufs'])
  })

  it('une chèvre mixte est laitière, pas pondeuse', () => {
    expect(delaisRequisSaisieLibre({ especeAnimale: { type: 'mammifere_petit', production: 'mixte' }, sexe: 'femelle' })).toEqual(['viande', 'lait'])
  })
})

describe('delaisManquantsSaisieLibre', () => {
  it('compte 0 comme saisi, null, absent et chaîne vide comme manquants', () => {
    expect(delaiSaisi(0)).toBe(true)
    expect(delaiSaisi('0')).toBe(true)
    expect(delaiSaisi(null)).toBe(false)
    expect(delaiSaisi(undefined)).toBe(false)
    expect(delaiSaisi(' ')).toBe(false)
    expect(delaisManquantsSaisieLibre(['viande', 'lait'], { tempsAttenteLaitJ: 0 })).toEqual(['viande'])
    expect(delaisManquantsSaisieLibre(['viande', 'lait'], { tempsAttenteLaitJ: 0, tempsAttenteViandeJ: 0 })).toEqual([])
  })
})
