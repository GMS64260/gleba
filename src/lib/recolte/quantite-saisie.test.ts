import { describe, expect, it } from 'vitest'
import { formatQuantiteSaisie } from './quantites'

describe('quantité vérifiable avant confirmation', () => {
  it.each([[0.001, '1 g'], [0.005, '5 g'], [1.005, '1,005 kg'], [0.75, '0,75 kg']])('conserve la pesée %s dans %s', (quantite, attendu) => {
    expect(formatQuantiteSaisie(Number(quantite), 'kg')).toBe(attendu)
  })
  it('garde l’unité de comptage', () => {
    expect(formatQuantiteSaisie(12, 'piece')).toBe('12 pièces')
  })
})
