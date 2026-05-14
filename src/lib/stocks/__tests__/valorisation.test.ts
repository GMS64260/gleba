import { describe, it, expect } from 'vitest'
import { valoriser, coutStandardDepuisPrixVente } from '../valorisation'

describe('valoriser', () => {
  describe('PMP (Prix Moyen Pondéré)', () => {
    it('valorise un stock avec entrées multiples : lisse les coûts', () => {
      // Entrée 100u @ 1€, puis 100u @ 2€ → PMP = 1.5€
      const r = valoriser(
        [
          { date: new Date('2026-01-01'), quantite: 100, coutUnitaire: 1 },
          { date: new Date('2026-02-01'), quantite: 100, coutUnitaire: 2 },
        ],
        'PMP'
      )
      expect(r.quantiteFinale).toBe(200)
      expect(r.coutUnitaireValorise).toBe(1.5)
      expect(r.valeurTotale).toBe(300)
    })

    it('après sortie partielle, PMP reste cohérent', () => {
      const r = valoriser(
        [
          { date: new Date('2026-01-01'), quantite: 100, coutUnitaire: 1 },
          { date: new Date('2026-02-01'), quantite: 100, coutUnitaire: 2 },
          { date: new Date('2026-03-01'), quantite: -50 }, // Sortie 50
        ],
        'PMP'
      )
      // Reste : 50u du lot 1€ + 100u du lot 2€ = 150u @ valeur 250€
      expect(r.quantiteFinale).toBe(150)
      expect(r.valeurTotale).toBeCloseTo(250, 1)
      // PMP : 250 / 150 ≈ 1.67
      expect(r.coutUnitaireValorise).toBeCloseTo(1.67, 1)
    })

    it('stock épuisé → quantité 0 valeur 0', () => {
      const r = valoriser(
        [
          { date: new Date('2026-01-01'), quantite: 50, coutUnitaire: 2 },
          { date: new Date('2026-02-01'), quantite: -50 },
        ],
        'PMP'
      )
      expect(r.quantiteFinale).toBe(0)
      expect(r.valeurTotale).toBe(0)
    })
  })

  describe('FIFO', () => {
    it("consomme les lots dans l'ordre d'entrée", () => {
      const r = valoriser(
        [
          { date: new Date('2026-01-01'), quantite: 100, coutUnitaire: 1 },
          { date: new Date('2026-02-01'), quantite: 100, coutUnitaire: 3 },
          { date: new Date('2026-03-01'), quantite: -100 }, // consomme lot 1
        ],
        'FIFO'
      )
      // Reste : 100u @ 3€ = 300€
      expect(r.quantiteFinale).toBe(100)
      expect(r.coutUnitaireValorise).toBe(3)
      expect(r.valeurTotale).toBe(300)
      expect(r.lotsRestants).toHaveLength(1)
      expect(r.lotsRestants[0].coutUnitaire).toBe(3)
    })

    it('sortie qui chevauche plusieurs lots', () => {
      const r = valoriser(
        [
          { date: new Date('2026-01-01'), quantite: 30, coutUnitaire: 1 },
          { date: new Date('2026-02-01'), quantite: 30, coutUnitaire: 2 },
          { date: new Date('2026-03-01'), quantite: 30, coutUnitaire: 3 },
          { date: new Date('2026-04-01'), quantite: -50 }, // consomme tout lot 1 + 20 du lot 2
        ],
        'FIFO'
      )
      // Reste : 10u @ 2€ + 30u @ 3€ = 110€
      expect(r.quantiteFinale).toBe(40)
      expect(r.valeurTotale).toBe(110)
      expect(r.lotsRestants).toEqual([
        expect.objectContaining({ quantite: 10, coutUnitaire: 2 }),
        expect.objectContaining({ quantite: 30, coutUnitaire: 3 }),
      ])
    })
  })

  describe('DERNIER_PRIX', () => {
    it('valorise au dernier prix d\'achat même pour les lots anciens', () => {
      const r = valoriser(
        [
          { date: new Date('2026-01-01'), quantite: 100, coutUnitaire: 1 },
          { date: new Date('2026-02-01'), quantite: 50, coutUnitaire: 4 },
        ],
        'DERNIER_PRIX'
      )
      expect(r.quantiteFinale).toBe(150)
      expect(r.coutUnitaireValorise).toBe(4)
      expect(r.valeurTotale).toBe(600)
    })

    it("ne plante pas si pas d'entrée", () => {
      const r = valoriser([], 'DERNIER_PRIX')
      expect(r.quantiteFinale).toBe(0)
      expect(r.valeurTotale).toBe(0)
    })
  })

  describe('robustesse', () => {
    it('mouvements non triés sont triés en interne', () => {
      const r = valoriser(
        [
          { date: new Date('2026-03-01'), quantite: 100, coutUnitaire: 3 },
          { date: new Date('2026-01-01'), quantite: 100, coutUnitaire: 1 },
        ],
        'FIFO'
      )
      // Lot janvier consommé d'abord en cas de sortie ; ici pas de sortie
      expect(r.quantiteFinale).toBe(200)
      expect(r.lotsRestants[0].coutUnitaire).toBe(1) // janvier en premier
    })

    it('coût unitaire absent → 0 (entrée gratuite)', () => {
      const r = valoriser(
        [{ date: new Date(), quantite: 10 }],
        'PMP'
      )
      expect(r.quantiteFinale).toBe(10)
      expect(r.valeurTotale).toBe(0)
    })
  })
})

describe('coutStandardDepuisPrixVente', () => {
  it('coût = prix de vente × (1 - marge/100)', () => {
    expect(coutStandardDepuisPrixVente(3, 40)).toBe(1.8)
    expect(coutStandardDepuisPrixVente(10, 25)).toBe(7.5)
  })

  it('marge 0 → coût = prix', () => {
    expect(coutStandardDepuisPrixVente(5, 0)).toBe(5)
  })

  it('refuse marge ≥ 100% ou prix ≤ 0', () => {
    expect(coutStandardDepuisPrixVente(5, 100)).toBe(0)
    expect(coutStandardDepuisPrixVente(0, 30)).toBe(0)
    expect(coutStandardDepuisPrixVente(-5, 30)).toBe(0)
  })
})
