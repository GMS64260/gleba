import { describe, expect, it } from 'vitest'
import {
  cleTypeSoin,
  libelleTypeSoin,
  normaliserTypeSoin,
  optionsFiltreTypeSoin,
  TYPES_SOIN,
} from './types-soin'

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

// QA 2026-10-19 — le carnet sanitaire affichait « Autre » pour les soins saisis
// « Vermifuge » et « Vaccination », et son filtre Vermifuge ne les trouvait pas.
describe('libellés et clé des types de soin', () => {
  it('chaque type de la liste a son propre libellé, jamais « Autre » par repli', () => {
    for (const { valeur } of TYPES_SOIN) {
      expect(libelleTypeSoin(valeur)).toBe(valeur)
      expect(cleTypeSoin(valeur)).toBe(valeur)
      if (valeur !== 'Autre') expect(libelleTypeSoin(valeur)).not.toBe('Autre')
    }
  })

  it('ramène les anciens codes en minuscules à la même clé que la saisie de l’écran', () => {
    expect(cleTypeSoin('vermifuge')).toBe(cleTypeSoin('Vermifuge'))
    expect(cleTypeSoin('vaccination')).toBe('Vaccination')
    expect(cleTypeSoin('traitement')).toBe('Traitement vétérinaire')
    expect(cleTypeSoin('autre')).toBe('Autre')
  })

  it('garde une valeur hors liste telle quelle et classe le vide en « Autre »', () => {
    expect(libelleTypeSoin('Visite de ruche')).toBe('Visite de ruche')
    // Pas de rattachement par préfixe à la lecture (carnet réglementaire).
    expect(cleTypeSoin('Prophylaxie')).toBe('Prophylaxie')
    expect(cleTypeSoin('Mise')).toBe('Mise')
    expect(cleTypeSoin('A')).toBe('A')
    expect(cleTypeSoin('vaccination ')).toBe('Vaccination')
    expect(cleTypeSoin('TRAITEMENT VETERINAIRE')).toBe('Traitement vétérinaire')
    expect(libelleTypeSoin('')).toBe('Autre')
    expect(libelleTypeSoin(null)).toBe('Autre')
  })

  it('le filtre propose la liste puis les valeurs hors liste présentes, sur la même clé', () => {
    const options = optionsFiltreTypeSoin(['Vermifuge', 'vermifuge', 'Visite de ruche'])
    expect(options.slice(0, TYPES_SOIN.length)).toEqual(TYPES_SOIN.map((t) => t.valeur))
    expect(options.slice(TYPES_SOIN.length)).toEqual(['Visite de ruche'])
    expect(options).toContain(cleTypeSoin('vermifuge'))
  })
})
