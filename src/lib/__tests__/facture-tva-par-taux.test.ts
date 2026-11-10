import { describe, expect, it } from 'vitest'
import { ventilerTvaParTaux } from '@/lib/facture-tva-par-taux'

const l = (netAmount: number, vatRate: number) => ({ netAmount, vatRate })
const somme = (v: { tva: number }[]) => Math.round(v.reduce((s, t) => s + t.tva, 0) * 100) / 100

describe('ventilation de la TVA par taux des factures structurées', () => {
  it('retrouve une TVA arrondie par taux', () => {
    const ventilation = ventilerTvaParTaux([l(100, 5.5), l(50, 20), l(25, 20)], 20.5)
    expect(ventilation).toEqual([{ taux: 5.5, base: 100, tva: 5.5 }, { taux: 20, base: 75, tva: 15 }])
  })

  it('retrouve une TVA arrondie ligne par ligne, que la somme globale refusait', () => {
    // Trois lignes à 1,00 € et 5,5 % : 0,06 chacune, soit 0,18 ; la base
    // sommée donne 0,165, soit 0,17.
    const lignes = [l(1, 5.5), l(1, 5.5), l(1, 5.5)]
    const parLigne = ventilerTvaParTaux(lignes, 0.18)
    expect(parLigne).toEqual([{ taux: 5.5, base: 3, tva: 0.18 }])
    expect(ventilerTvaParTaux(lignes, 0.17)).toEqual([{ taux: 5.5, base: 3, tva: 0.17 }])
  })

  it('à deux taux, les montants par taux somment toujours au total enregistré', () => {
    const lignes = [l(10.05, 5.5), l(3.33, 5.5), l(10.05, 20), l(0.99, 20)]
    for (const total of [2.95, 2.94]) {
      const ventilation = ventilerTvaParTaux(lignes, total)
      if (ventilation) expect(somme(ventilation)).toBe(total)
    }
    expect(ventilerTvaParTaux(lignes, 2.95)).not.toBeNull()
  })

  it('refuse un total qu’aucun arrondi ne retrouve', () => {
    expect(ventilerTvaParTaux([l(100, 20)], 19)).toBeNull()
    expect(ventilerTvaParTaux([l(1, 5.5), l(1, 5.5), l(1, 5.5)], 0.2)).toBeNull()
  })

  it('franchise : taux nul, TVA nulle', () => {
    expect(ventilerTvaParTaux([l(40, 0), l(2.5, 0)], 0)).toEqual([{ taux: 0, base: 42.5, tva: 0 }])
  })
})
