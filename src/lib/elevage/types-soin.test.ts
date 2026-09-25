import { describe, expect, it } from 'vitest'
import { normaliserTypeSoin, TYPES_SOIN } from './types-soin'

describe('types de soin', () => {
  it("ramène une saisie libre à la valeur enregistrée par l'écran", () => {
    expect(normaliserTypeSoin('autre')).toBe('Autre')
    expect(normaliserTypeSoin('vermifuge')).toBe('Vermifuge')
    expect(normaliserTypeSoin('traitement')).toBe('Traitement vétérinaire')
    expect(normaliserTypeSoin('Traitement veterinaire')).toBe('Traitement vétérinaire')
    expect(normaliserTypeSoin('prophylaxie')).toBe('Prophylaxie obligatoire')
    expect(normaliserTypeSoin('  Coproscopie ')).toBe('Coproscopie')
  })

  it('refuse une saisie inconnue ou ambiguë', () => {
    expect(normaliserTypeSoin('radiographie')).toBeNull()
    expect(normaliserTypeSoin('')).toBeNull()
    // « t » commence Traitement, Tonte et Tarissement.
    expect(normaliserTypeSoin('t')).toBeNull()
  })

  it('garde les actes de rente repérables', () => {
    expect(TYPES_SOIN.filter((t) => t.rente).map((t) => t.valeur)).toEqual([
      'Tonte', 'Parage onglons', 'Prophylaxie obligatoire', 'Coproscopie', 'Mise en lutte', 'Tarissement',
    ])
  })
})
