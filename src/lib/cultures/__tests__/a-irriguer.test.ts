import { describe, expect, it } from 'vitest'

import { aIrriguerALaCreation } from '../a-irriguer'

describe('aIrriguerALaCreation', () => {
  it('respecte un choix explicite, même contre le besoin de l’espèce', () => {
    expect(aIrriguerALaCreation(false, { besoinEau: 5, irrigation: 'Élevé' })).toBe(false)
    expect(aIrriguerALaCreation(true, { besoinEau: 1, irrigation: 'Faible' })).toBe(true)
  })

  it('marque à irriguer une espèce gourmande en eau quand rien n’est choisi', () => {
    for (const choix of [undefined, null]) {
      expect(aIrriguerALaCreation(choix, { besoinEau: 3 })).toBe(true)
      expect(aIrriguerALaCreation(choix, { besoinEau: 4, irrigation: null })).toBe(true)
      expect(aIrriguerALaCreation(choix, { besoinEau: null, irrigation: 'Eleve' })).toBe(true)
      expect(aIrriguerALaCreation(choix, { besoinEau: 1, irrigation: ' ÉLEVÉ ' })).toBe(true)
    }
  })

  it('rend la valeur reçue pour une espèce sobre ou inconnue', () => {
    expect(aIrriguerALaCreation(undefined, { besoinEau: 2, irrigation: 'Moyen' })).toBeUndefined()
    expect(aIrriguerALaCreation(null, { besoinEau: 2, irrigation: 'Moyen' })).toBeNull()
    expect(aIrriguerALaCreation(undefined, { besoinEau: 0 })).toBeUndefined()
    expect(aIrriguerALaCreation(undefined, null)).toBeUndefined()
    expect(aIrriguerALaCreation(undefined, {})).toBeUndefined()
  })
})
