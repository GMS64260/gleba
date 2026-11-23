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

  // FB-YV1HCU — tout ce que la suppression détache est annoncé.
  it('annonce aussi les objets du plan, les capteurs et les campagnes de plantation', () => {
    const refus = refusSuppressionParcelle(usagesParcelle({ planches: 1, objetsJardin: 1, capteurs: 2, campagnesPlantation: 1 }), false)
    expect(refus?.error).toContain('1 planche(s), 2 capteur(s), 1 objet(s) du plan, 1 campagne(s) de plantation')
  })

  it('refuse une parcelle qui porte un lot d’arbres : sa clé étrangère interdit la suppression', () => {
    const refus = refusSuppressionParcelle(usagesParcelle({ lotsArbres: 2 }), true)
    expect(refus?.code).toBe('PARCELLE_TRACEE')
    expect(refus?.error).toContain("2 lot(s) d'arbres")
  })
})
