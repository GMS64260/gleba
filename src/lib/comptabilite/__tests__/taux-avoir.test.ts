import { describe, expect, it } from 'vitest'
import { tauxEtrangerALaFacture } from '@/lib/comptabilite/taux-avoir'

describe('taux de TVA d’un avoir', () => {
  it('refuse 5,5 % sur une facture à 20 %', () => {
    expect(tauxEtrangerALaFacture([20], [{ tauxTVA: 5.5 }])).toBe(5.5)
  })
  it('accepte les taux de la facture d’origine, y compris plusieurs', () => {
    expect(tauxEtrangerALaFacture([5.5, 20], [{ tauxTVA: 20 }, { tauxTVA: 5.5 }])).toBeNull()
    expect(tauxEtrangerALaFacture([0], [{ tauxTVA: 0 }])).toBeNull()
  })
  it('ne bloque pas une facture d’origine sans ligne lue', () => {
    expect(tauxEtrangerALaFacture([], [{ tauxTVA: 5.5 }])).toBeNull()
  })
})
