import { describe, expect, it } from 'vitest'
import { refusSuppressionParcelle, usagesParcelle } from './suppression'

describe('garde de suppression d’une parcelle', () => {
  it('laisse supprimer une parcelle vide sans confirmation', () => {
    expect(refusSuppressionParcelle(usagesParcelle({ planches: 0, recoltesArbres: 0 }), false)).toBeNull()
  })

  it('refuse une parcelle d’origine de récoltes ou de traitements, même confirmée', () => {
    const usages = usagesParcelle({ recoltesArbres: 4, interventionsPhyto: 2, planches: 3 })
    expect(usages.traces).toEqual({ recoltesArbres: 4, interventionsPhyto: 2 })
    const refus = refusSuppressionParcelle(usages, true)
    expect(refus?.code).toBe('PARCELLE_TRACEE')
    expect(refus?.error).toContain('4 récolte(s) de fruits')
    expect(refus?.error).toContain('2 traitement(s)')
  })

  it('demande une confirmation quand des planches, arbres ou lots seraient détachés', () => {
    const usages = usagesParcelle({ planches: 3, arbres: 12, lotsAnimaux: 1 })
    const refus = refusSuppressionParcelle(usages, false)
    expect(refus?.code).toBe('PARCELLE_RATTACHEE')
    expect(refus?.error).toContain('3 planche(s), 12 arbre(s), 1 lot(s) d\'animaux')
    expect(refusSuppressionParcelle(usages, true)).toBeNull()
  })
})
