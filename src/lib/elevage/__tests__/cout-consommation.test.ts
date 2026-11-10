import { describe, expect, it, vi } from 'vitest'
import { chargerMontantsFigesConsommations, coutConsommation, prixDuJourAliment } from '../cout-consommation'

describe('coût d’une consommation d’aliment', () => {
  const aliment = { prix: 0.5, userStocks: [{ prix: 0.6, coutUnitaire: 0.8 }] }

  it('retient le montant figé à la saisie, pas le prix du jour', () => {
    // 100 kg saisis quand l'aliment coûtait 0,40 €/kg ; il en coûte 0,80 aujourd'hui.
    const figes = new Map([[1, 40]])
    expect(coutConsommation({ id: 1, quantite: 100, aliment }, figes)).toBe(40)
    expect(coutConsommation({ id: 2, quantite: 100, aliment }, figes)).toBe(80)
  })

  it('prix du jour : coût unitaire du stock, puis son prix, puis le catalogue ; zéro est un prix', () => {
    expect(prixDuJourAliment(aliment)).toBe(0.8)
    expect(prixDuJourAliment({ prix: 0.5, userStocks: [{ prix: 0.6, coutUnitaire: null }] })).toBe(0.6)
    expect(prixDuJourAliment({ prix: 0.5, userStocks: [] })).toBe(0.5)
    expect(prixDuJourAliment({ prix: 0.5, userStocks: [{ prix: 0.6, coutUnitaire: 0 }] })).toBe(0)
    expect(prixDuJourAliment(null)).toBe(0)
  })

  it('lit les écritures de gestion du seul compte', async () => {
    const findMany = vi.fn(async () => [{ sourceId: 1, montant: 40 }, { sourceId: 3, montant: 12.5 }, { sourceId: null, montant: 9 }])
    const montants = await chargerMontantsFigesConsommations({ depenseManuelle: { findMany } } as never, 'user-1', [1, 2, 3])
    expect([...montants]).toEqual([[1, 40], [3, 12.5]])
    expect(findMany.mock.calls[0]).toEqual([{
      where: { userId: 'user-1', auto: true, sourceType: 'consommation_aliment', sourceId: { in: [1, 2, 3] } },
      select: { sourceId: true, montant: true },
    }])
    expect((await chargerMontantsFigesConsommations({ depenseManuelle: { findMany } } as never, 'user-1', [])).size).toBe(0)
  })
})
