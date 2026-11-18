import { describe, expect, it } from 'vitest'
import { HORIZON_DAR_INCONNU_JOURS, resoudreDar, verdictDar, type CalendrierDar } from './delai-avant-recolte'

const GRAINE = 20261117
const JOUR = 86_400_000
const calendrier: CalendrierDar = {
  ajouterJours: (jour, n) => jour + n * JOUR,
  formater: (jour) => new Date(jour).toISOString().slice(0, 10),
  iso: (jour) => new Date(jour).toISOString().slice(0, 10),
}

describe(`DAR connu, inconnu et geste sans produit — graine ${GRAINE}`, () => {
  it('768 dates : une substance sans DAR rappelle ses conditions ; zéro explicite et geste sans produit restent sans délai', () => {
    let etat = GRAINE
    const entier = (max: number) => {
      etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
      return etat % max
    }
    for (let n = 0; n < 768; n++) {
      const jourTraitement = Date.UTC(2020 + entier(10), entier(12), 1 + entier(28))
      const ecart = entier(HORIZON_DAR_INCONNU_JOURS)
      const application = { jourTraitement, jourRecolte: jourTraitement + ecart * JOUR, produit: `Substance témoin ${n}`, nature: 'sans_amm' as const }
      const inconnu = verdictDar({ ...application, dar: resoudreDar(null, null) }, calendrier)
      expect(inconnu.niveau).toBe('informatif')
      if (inconnu.niveau === 'informatif') {
        expect(inconnu.message).toContain('conditions d’approbation')
        expect(inconnu.message).not.toMatch(/AMM|3 jours/)
      }
      expect(verdictDar({ ...application, dar: resoudreDar(0, entier(100)) }, calendrier)).toEqual({ niveau: 'rien' })
      expect(verdictDar({ ...application, nature: 'sans_produit', dar: resoudreDar(null, null) }, calendrier)).toEqual({ niveau: 'rien' })
      const delai = 1 + entier(120)
      expect(verdictDar({ ...application, jourRecolte: jourTraitement + (delai - 1) * JOUR, dar: resoudreDar(delai, null) }, calendrier).niveau).toBe('bloquant')
      expect(verdictDar({ ...application, jourRecolte: jourTraitement + delai * JOUR, dar: resoudreDar(delai, null) }, calendrier)).toEqual({ niveau: 'rien' })
      expect(verdictDar({ ...application, jourRecolte: jourTraitement - JOUR, dar: resoudreDar(null, null) }, calendrier)).toEqual({ niveau: 'rien' })
    }
  })
})
