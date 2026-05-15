/**
 * BUG #7 — tests : sélecteur d'agrégation valeur stocks + moyenne prix.
 */

import { describe, it, expect } from 'vitest'
import { computeStocksTotaux, moyennePrix, type StockItem } from '../agregation'

function item(partial: Partial<StockItem>): StockItem {
  return {
    id: 'x',
    module: 'potager',
    categorie: 'Test',
    nom: 'Article',
    stock: 1,
    unite: 'kg',
    stockMin: null,
    alerteBas: false,
    valeur: null,
    ...partial,
  }
}

describe('computeStocksTotaux (BUG #7)', () => {
  it('renvoie zéro sur tableau vide', () => {
    const r = computeStocksTotaux([])
    expect(r.valeurTotale).toBe(0)
    expect(r.valeurParModule).toEqual({ potager: 0, verger: 0, elevage: 0 })
    expect(r.itemsParModule).toEqual({ potager: 0, verger: 0, elevage: 0 })
  })

  it("ignore les `valeur` null (article non valorisable) mais compte l'item", () => {
    const r = computeStocksTotaux([
      item({ module: 'elevage', valeur: null }),
      item({ module: 'verger', valeur: null }),
    ])
    expect(r.valeurTotale).toBe(0)
    expect(r.itemsParModule).toEqual({ potager: 0, verger: 1, elevage: 1 })
  })

  it('somme les valeurs et fait le breakdown par module', () => {
    const r = computeStocksTotaux([
      item({ module: 'potager', valeur: 10.5 }),
      item({ module: 'potager', valeur: 4.5 }),
      item({ module: 'verger', valeur: 30 }),
      item({ module: 'elevage', valeur: 12.3 }),
    ])
    expect(r.valeurTotale).toBe(57.3)
    expect(r.valeurParModule).toEqual({ potager: 15, verger: 30, elevage: 12.3 })
    expect(r.itemsParModule).toEqual({ potager: 2, verger: 1, elevage: 1 })
  })

  it('mélange null + 0 + valeurs', () => {
    const r = computeStocksTotaux([
      item({ module: 'verger', valeur: null }),    // null ignoré
      item({ module: 'verger', valeur: 0 }),       // 0 compté
      item({ module: 'elevage', valeur: 25 }),
    ])
    expect(r.valeurTotale).toBe(25)
    expect(r.valeurParModule.verger).toBe(0)
    expect(r.valeurParModule.elevage).toBe(25)
  })

  it('rejette les NaN / Infinity dans valeur', () => {
    const r = computeStocksTotaux([
      item({ module: 'potager', valeur: NaN }),
      item({ module: 'potager', valeur: Infinity }),
      item({ module: 'potager', valeur: 5 }),
    ])
    expect(r.valeurTotale).toBe(5)
  })

  it('arrondit à 2 décimales pour éviter les flottants laids', () => {
    const r = computeStocksTotaux([
      item({ valeur: 0.1 }),
      item({ valeur: 0.2 }),
    ])
    expect(r.valeurTotale).toBe(0.3) // pas 0.30000000000004
  })

  it('reproduit le scénario Marc : 8 articles dont 1 fruit valorisé', () => {
    // Simule ce que voyait Camille avant le fix : majorité null + 1 valeur.
    const r = computeStocksTotaux([
      item({ module: 'elevage', valeur: null }),  // animaux
      item({ module: 'elevage', valeur: null }),  // animaux
      item({ module: 'elevage', valeur: null }),  // œufs (était null !)
      item({ module: 'verger', valeur: null }),   // arbres
      item({ module: 'verger', valeur: null }),   // arbres
      item({ module: 'verger', valeur: null }),   // arbres
      item({ module: 'verger', valeur: null }),   // arbres
      item({ module: 'verger', valeur: 37.5 }),   // 12,5 kg de fruits × 3 €/kg
    ])
    // Avant le fix de valorisation côté route, total = 37.5
    expect(r.valeurTotale).toBe(37.5)
    expect(r.itemsParModule).toEqual({ potager: 0, verger: 5, elevage: 3 })
  })
})

describe('moyennePrix (BUG #7)', () => {
  it('renvoie null sur liste vide', () => {
    expect(moyennePrix([])).toBeNull()
  })

  it('renvoie null si tous les prix sont nuls/négatifs', () => {
    expect(moyennePrix([null, undefined, 0, -3])).toBeNull()
  })

  it('moyenne arithmétique des prix valides', () => {
    expect(moyennePrix([2, 4, 6])).toBe(4)
  })

  it('ignore les non-nombres et infinis', () => {
    expect(moyennePrix([2, NaN, Infinity, 4])).toBe(3)
  })

  it('arrondit à 2 décimales', () => {
    expect(moyennePrix([3.333, 3.334])).toBe(3.33)
  })
})
