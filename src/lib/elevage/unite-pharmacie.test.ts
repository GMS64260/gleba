import { describe, expect, it } from 'vitest'
import { convertirQuantitePharmacie, memeUnitePharmacie } from './unite-pharmacie'

describe('convertirQuantitePharmacie', () => {
  it('convertit un volume dans l’unité du lot', () => {
    expect(convertirQuantitePharmacie(1, 'L', 'mL')).toBe(1000)
    expect(convertirQuantitePharmacie(250, 'mL', 'L')).toBe(0.25)
    expect(convertirQuantitePharmacie(12.5, 'cl', 'ml')).toBe(125)
  })

  it('convertit une masse', () => {
    expect(convertirQuantitePharmacie(1.5, 'kg', 'g')).toBe(1500)
    expect(convertirQuantitePharmacie(500, 'mg', 'g')).toBe(0.5)
  })

  it('rapproche les écritures d’une même unité', () => {
    expect(memeUnitePharmacie('mL', ' ml ')).toBe(true)
    expect(convertirQuantitePharmacie(3, 'millilitres', 'mL')).toBe(3)
    expect(convertirQuantitePharmacie(2, 'Flacons', 'flacon')).toBe(2)
    expect(convertirQuantitePharmacie(4, 'comprimé', 'comprimés')).toBe(4)
    expect(convertirQuantitePharmacie(5, 'cc', 'mL')).toBe(5)
  })

  it('refuse d’additionner des unités sans rapport', () => {
    expect(convertirQuantitePharmacie(1, 'L', 'g')).toBeNull()
    expect(convertirQuantitePharmacie(1, 'flacon', 'mL')).toBeNull()
    expect(convertirQuantitePharmacie(1, 'dose', 'comprimé')).toBeNull()
  })
})
