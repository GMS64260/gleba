import { describe, expect, it } from 'vitest'
import { commandableStockLie, ErreurStockLie, lireStockLie, quantiteStockLie, validerStockLie } from './stock-lie'
import { regleDeRattachement } from './reprise-stock-lie'
import { lignesEnRuptureStockLie, type EtatStockLie } from './stock-lie-disponible'

describe('stock lié : validation du lien', () => {
  it('accepte un conditionnement entier pour les œufs, saisi en texte ou en nombre', () => {
    expect(validerStockLie({ type: 'oeufs', conditionnement: '12' })).toEqual({ type: 'oeufs', ref: 'stock', conditionnement: 12 })
    expect(validerStockLie({ type: 'oeufs', ref: 'ignoré', conditionnement: 6 })?.ref).toBe('stock')
    expect(validerStockLie(null)).toBeNull()
  })
  it('refuse une fraction d’œuf, un conditionnement nul ou trop précis, un stock inconnu', () => {
    for (const brut of [{ type: 'oeufs', conditionnement: 0.5 }, { type: 'oeufs', conditionnement: 0 }, { type: 'oeufs', conditionnement: -1 }, { type: 'ruche', ref: 'miel', conditionnement: 0.0005 }, { type: 'ruche', ref: 'confiture', conditionnement: 1 }, { type: 'viande', ref: 'x', conditionnement: 1 }, 'oeufs'])
      expect(() => validerStockLie(brut)).toThrow(ErreurStockLie)
  })
  it('accepte la virgule française et le millième pour un stock pesé', () => {
    expect(validerStockLie({ type: 'ruche', ref: 'miel', conditionnement: '0,25' }, 'kg')).toEqual({ type: 'ruche', ref: 'miel', conditionnement: 0.25 })
  })
  it('ne lit pas un lien incomplet ou d’un type que la boutique ne sait pas sortir', () => {
    expect(lireStockLie({ stockLieType: 'oeufs', stockLieRef: 'stock', stockLieConditionnement: null })).toBeNull()
    expect(lireStockLie({ stockLieType: 'fromage', stockLieRef: 'x', stockLieConditionnement: 1 })).toBeNull()
    expect(lireStockLie({ stockLieType: null, stockLieRef: null, stockLieConditionnement: null })).toBeNull()
  })
})

describe('stock lié : quantités', () => {
  it('convertit au millième sans dérive binaire', () => {
    expect(quantiteStockLie(3, 0.1)).toBe(0.3)
    expect(quantiteStockLie(2, 12)).toBe(24)
  })
  it('ne propose que des unités entières d’un produit vendu à la pièce', () => {
    expect(commandableStockLie(40, 0, 12, true)).toBe(3)
    expect(commandableStockLie(40, 36, 12, true)).toBe(0)
    expect(commandableStockLie(36, 0, 12, true)).toBe(3)
    expect(commandableStockLie(0.3, 0, 0.1, true)).toBe(3)
    expect(commandableStockLie(1.25, 0.5, 1, false)).toBe(0.75)
    expect(commandableStockLie(5, 9, 1, true)).toBe(0)
  })
  it('cumule la demande des produits qui vendent le même stock', () => {
    const etats = new Map<string, EtatStockLie>([['oeufs:stock', { type: 'oeufs', ref: 'stock', nom: 'Œufs', unite: 'pièce', disponible: 40, retenu: 10, tauxTVA: 5.5 }]])
    const ligne = (nom: string, quantite: number, c: number) => ({ nom, quantite, stockLieType: 'oeufs', stockLieRef: 'stock', stockLieConditionnement: c })
    expect(lignesEnRuptureStockLie(etats, [ligne('Douzaine', 2, 12), ligne('Boîte', 1, 6)])).toEqual([])
    expect(lignesEnRuptureStockLie(etats, [ligne('Douzaine', 2, 12), ligne('Boîte', 2, 6)]).map((l) => l.nom)).toEqual(['Boîte'])
    expect(lignesEnRuptureStockLie(etats, [{ nom: 'Libre', quantite: 99, stockLieType: null, stockLieRef: null, stockLieConditionnement: null }])).toEqual([])
    expect(lignesEnRuptureStockLie(new Map(), [ligne('Douzaine', 1, 12)]).map((l) => l.nom)).toEqual(['Douzaine'])
    // 1,1 demi-douzaine = 6,6 œufs : jamais sortable, donc refusée à la commande.
    expect(lignesEnRuptureStockLie(etats, [ligne('Demi-douzaine', 1.1, 6)]).map((l) => l.nom)).toEqual(['Demi-douzaine'])
  })
})

describe('reprise : règle de rattachement', () => {
  const produit = (categorie: string | null, unite: string, plus: Partial<{ recolteId: number | null; stockDispo: number | null }> = {}) => ({ categorie, unite, recolteId: null, stockDispo: null, ...plus })
  it('relie les conditionnements sans ambiguïté', () => {
    expect(regleDeRattachement(produit('oeufs', 'douzaine'))).toEqual({ lie: { type: 'oeufs', ref: 'stock', conditionnement: 12 } })
    expect(regleDeRattachement(produit('Oeufs', ' Demi-douzaine '))).toEqual({ lie: { type: 'oeufs', ref: 'stock', conditionnement: 6 } })
    expect(regleDeRattachement(produit('miel', 'g'))).toEqual({ lie: { type: 'ruche', ref: 'miel', conditionnement: 0.001 } })
  })
  it('ne devine jamais une contenance, un compteur propre ou une récolte', () => {
    for (const p of [produit('oeufs', 'barquette'), produit('oeufs', 'boîte'), produit('miel', 'pot'), produit('legumes', 'kg'), produit(null, 'douzaine'), produit('oeufs', 'douzaine', { stockDispo: 4 }), produit('oeufs', 'douzaine', { recolteId: 7 })])
      expect(regleDeRattachement(p)).toHaveProperty('raison')
  })
})
