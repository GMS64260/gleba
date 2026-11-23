import { describe, expect, it } from 'vitest'
import { montantBoisAvoir } from '@/lib/comptabilite/avoirs-bois'

// FB-8Y5FFX — la part « Bois » du graphique par catégorie ignorait les avoirs.
describe('part d’un avoir imputée aux ventes de bois', () => {
  it('avoir sans ligne sur une facture de bois seul : tout son montant', () => {
    expect(montantBoisAvoir({ totalTTC: 100, lignes: [], origineToutBois: true })).toBe(100)
  })
  it('compte les lignes liées au bois et les lignes libres quand la facture ne porte que du bois', () => {
    expect(montantBoisAvoir({
      totalTTC: 100, origineToutBois: true,
      lignes: [{ montantTTC: 60, articleStockType: 'bois' }, { montantTTC: 40, articleStockType: null }],
    })).toBe(100)
  })
  it('sur une facture mixte, ne retient que les lignes liées au bois', () => {
    expect(montantBoisAvoir({
      totalTTC: 100, origineToutBois: false,
      lignes: [{ montantTTC: 60, articleStockType: 'bois' }, { montantTTC: 30, articleStockType: 'fruit' }, { montantTTC: 10, articleStockType: null }],
    })).toBe(60)
    expect(montantBoisAvoir({ totalTTC: 100, lignes: [], origineToutBois: false })).toBe(0)
  })
})
