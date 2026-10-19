/**
 * Cave de fromage : unité de vente, stock restant et valorisation.
 * QA 2026-10-19 — 2 pièces vendues à 2 €/pièce sur un lot de 4 pièces pour
 * 0,30 kg : la cave affichait « 2 pc · 0,3 kg » valorisés 0,60 €.
 */
import { describe, expect, it } from 'vitest'
import {
  prixConstateFromage,
  sortieCaveDepuisVente,
  stockLotFromage,
  uniteVenteFromage,
  valoriserStockFromage,
} from './cave-fromage'

const crottins = { nbPieces: 4, poidsTotalKg: 0.3 }

describe('unité de vente du fromage', () => {
  it('reconnaît le poids et la pièce, casse et accents ignorés', () => {
    expect(uniteVenteFromage('kg')).toEqual({ unite: 'kg', facteurKg: 1 })
    expect(uniteVenteFromage('g')).toEqual({ unite: 'kg', facteurKg: 0.001 })
    expect(uniteVenteFromage('pièce')?.unite).toBe('piece')
    expect(uniteVenteFromage('Piece')?.unite).toBe('piece')
    expect(uniteVenteFromage('unite')?.unite).toBe('piece')
    expect(uniteVenteFromage('Unité')?.unite).toBe('piece')
  })

  it("n'invente pas d'unité pour une douzaine, un litre ou une saisie vide", () => {
    expect(uniteVenteFromage('douzaine')).toBeNull()
    expect(uniteVenteFromage('L')).toBeNull()
    expect(uniteVenteFromage('')).toBeNull()
    expect(uniteVenteFromage(null)).toBeNull()
  })

  it('dérive la sortie de cave de la vente : pièces ou poids, jamais les deux', () => {
    expect(sortieCaveDepuisVente(2, 'pièce')).toEqual({ ok: true, nbPieces: 2, poidsKg: 0 })
    expect(sortieCaveDepuisVente(0.15, 'kg')).toEqual({ ok: true, nbPieces: 0, poidsKg: 0.15 })
    expect(sortieCaveDepuisVente(250, 'g')).toEqual({ ok: true, nbPieces: 0, poidsKg: 0.25 })
  })

  it('refuse en nommant le champ une unité inconnue ou des pièces fractionnaires', () => {
    expect(sortieCaveDepuisVente(2, 'douzaine')).toMatchObject({ ok: false, champ: 'unite' })
    expect(sortieCaveDepuisVente(1.5, 'pièce')).toMatchObject({ ok: false, champ: 'quantite' })
  })
})

describe('stock restant d’un lot de fromage', () => {
  it('une vente à la pièce sans pesée retire le poids moyen des pièces', () => {
    const stock = stockLotFromage(crottins, [{ nbPieces: 2, poidsKg: 0 }])
    expect(stock.restantPieces).toBe(2)
    expect(stock.restantKg).toBe(0.15)
    expect(stock.epuise).toBe(false)
  })

  it('une sortie pesée retire son poids réel', () => {
    const stock = stockLotFromage(crottins, [{ nbPieces: 2, poidsKg: 0.16 }])
    expect(stock.restantPieces).toBe(2)
    expect(stock.restantKg).toBe(0.14)
  })

  it('les pièces suivent le compte, sans plafond par le poids', () => {
    // Vente au poids seul : le poids baisse, le compte de pièces ne bouge pas.
    expect(stockLotFromage(crottins, [{ nbPieces: 0, poidsKg: 0.15 }])).toMatchObject({
      restantPieces: 4,
      restantKg: 0.15,
      epuise: false,
    })
    // 10 pièces pour 1,5 kg : 5 pièces données pesées 0,9 kg, puis 4 vendues
    // sans pesée. Le poids tombe à 0 mais la 5e pièce reste en cave.
    const lot = { nbPieces: 10, poidsTotalKg: 1.5 }
    expect(stockLotFromage(lot, [{ nbPieces: 5, poidsKg: 0.9 }])).toMatchObject({ restantPieces: 5, restantKg: 0.6 })
    expect(
      stockLotFromage(lot, [
        { nbPieces: 5, poidsKg: 0.9 },
        { nbPieces: 4, poidsKg: 0 },
      ]),
    ).toMatchObject({ restantPieces: 1, restantKg: 0, epuise: false })
    // Une tomme coupée reste une pièce tant qu'il en reste.
    const tomme = stockLotFromage({ nbPieces: 1, poidsTotalKg: 2 }, [{ nbPieces: 0, poidsKg: 0.5 }])
    expect(tomme).toMatchObject({ restantPieces: 1, restantKg: 1.5, epuise: false })
  })

  it('le lot est épuisé sans pièce restante, et son poids restant tombe à 0', () => {
    const stock = stockLotFromage(crottins, [{ nbPieces: 4, poidsKg: 0.28 }])
    expect(stock).toMatchObject({ restantPieces: 0, restantKg: 0, epuise: true })
    // Vendu au poids seul jusqu'au dernier gramme : épuisé, 0 pièce affichée.
    expect(stockLotFromage(crottins, [{ nbPieces: 0, poidsKg: 0.3 }])).toMatchObject({
      restantPieces: 0,
      restantKg: 0,
      epuise: true,
    })
  })

  it('un lot sans poids de fabrication se suit en pièces seulement', () => {
    const stock = stockLotFromage({ nbPieces: 6, poidsTotalKg: 0 }, [{ nbPieces: 2, poidsKg: 0 }])
    expect(stock).toMatchObject({ restantPieces: 4, restantKg: 0, suiviPoids: false, epuise: false })
  })
})

describe('valorisation du stock de cave', () => {
  it('prix à la pièce : pièces restantes × prix constaté (cas du signalement)', () => {
    const ventes = [{ quantite: 2, unite: 'pièce', prixTotal: 4 }]
    const stock = stockLotFromage(crottins, [{ nbPieces: 2, poidsKg: 0 }])
    expect(valoriserStockFromage(crottins, stock, ventes)).toEqual({
      valorisation: 4,
      prix: { montant: 2, unite: 'piece' },
    })
  })

  it('prix au kg : poids restant × prix constaté', () => {
    const tomme = { nbPieces: 1, poidsTotalKg: 2 }
    const ventes = [{ quantite: 0.5, unite: 'kg', prixTotal: 10 }]
    const stock = stockLotFromage(tomme, [{ nbPieces: 0, poidsKg: 0.5 }])
    expect(valoriserStockFromage(tomme, stock, ventes)).toEqual({
      valorisation: 30,
      prix: { montant: 20, unite: 'kg' },
    })
  })

  it('vente au gramme : prix ramené au kg', () => {
    expect(prixConstateFromage(crottins, [{ quantite: 250, unite: 'g', prixTotal: 5 }])).toEqual({
      montant: 20,
      unite: 'kg',
    })
  })

  it('poids absent : un lot sans poids se valorise à la pièce', () => {
    const lot = { nbPieces: 6, poidsTotalKg: 0 }
    const stock = stockLotFromage(lot, [{ nbPieces: 2, poidsKg: 0 }])
    expect(valoriserStockFromage(lot, stock, [{ quantite: 2, unite: 'pièce', prixTotal: 6 }]).valorisation).toBe(12)
  })

  it('mélange pièce et kg : tout est ramené au kg par le poids moyen d’une pièce', () => {
    // 2 pièces à 2 € (0,15 kg au poids moyen) + 0,075 kg à 1,5 € : 5,5 € pour 0,225 kg.
    const ventes = [
      { quantite: 2, unite: 'pièce', prixTotal: 4 },
      { quantite: 0.075, unite: 'kg', prixTotal: 1.5 },
    ]
    const stock = stockLotFromage(crottins, [
      { nbPieces: 2, poidsKg: 0 },
      { nbPieces: 0, poidsKg: 0.075 },
    ])
    expect(stock).toMatchObject({ restantPieces: 2, restantKg: 0.075 })
    const { valorisation, prix } = valoriserStockFromage(crottins, stock, ventes)
    expect(prix?.unite).toBe('kg')
    expect(prix?.montant).toBeCloseTo(24.44, 2)
    expect(valorisation).toBe(1.83)
  })

  it('sans vente payante, pas de prix : la valorisation reste vide', () => {
    const stock = stockLotFromage(crottins, [])
    expect(valoriserStockFromage(crottins, stock, [])).toEqual({ valorisation: null, prix: null })
    expect(valoriserStockFromage(crottins, stock, [{ quantite: 1, unite: 'pièce', prixTotal: 0 }]).valorisation).toBeNull()
    // Une vente d'unité inconnue (historique) ne fixe pas de prix.
    expect(valoriserStockFromage(crottins, stock, [{ quantite: 1, unite: 'douzaine', prixTotal: 9 }]).prix).toBeNull()
  })
})
