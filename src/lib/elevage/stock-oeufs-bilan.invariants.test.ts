import { describe, expect, it } from 'vitest'
import { bilanPontesOeufs } from './stock-oeufs'

const GRAINE = 0x5e202611

describe(`bilan des œufs — invariants génératifs, graine ${GRAINE}`, () => {
  it('conserve les flux, les retours et le plancher par lot sur 500 historiques', () => {
    let etat = GRAINE
    const nombre = (max: number) => {
      etat = (Math.imul(1664525, etat) + 1013904223) >>> 0
      return etat % max
    }
    for (let serie = 0; serie < 500; serie++) {
      const pontes = Array.from({ length: nombre(50) }, () => ({
        quantite: nombre(500), casses: nombre(20), sales: nombre(10),
        mouvementsStock: Array.from({ length: nombre(10) }, () => ({
          type: ['vente', 'don', 'retour_commercial'][nombre(3)], quantite: nombre(100) - 20,
        })),
      }))
      const b = bilanPontesOeufs(pontes)
      const attendu = pontes.reduce((total, p) => total + Math.max(0, p.quantite - p.casses - p.sales - p.mouvementsStock.reduce((q, m) => q + m.quantite, 0)), 0)
      expect(b.stockPhysique, `série ${serie}`).toBe(attendu)
      expect(b.pondus - b.casses - b.sales - b.sorties + b.ecartPlancher).toBe(attendu)
      expect(b.ventes + b.autresSorties - b.retours).toBe(b.sorties)
      expect(b.ecartPlancher).toBeGreaterThanOrEqual(0)
      const milieu = Math.floor(pontes.length / 2)
      const gauche = bilanPontesOeufs(pontes.slice(0, milieu))
      const droite = bilanPontesOeufs(pontes.slice(milieu))
      for (const cle of Object.keys(b) as Array<keyof typeof b>) expect(gauche[cle] + droite[cle]).toBe(b[cle])
    }
  })
})
