import { describe, expect, it } from 'vitest'
import { UGB_PAR_DEFAUT, ugbParTete } from './ugb'

describe('ugbParTete', () => {
  it('lit l’espèce de base du catalogue, quel que soit le nom affiché', () => {
    expect(ugbParTete({ id: 'brebis', nom: 'Brebis (toutes races)' })).toBe(0.15)
    expect(ugbParTete({ id: 'brebis_lacaune', nom: 'Brebis Lacaune' })).toBe(0.15)
    expect(ugbParTete({ id: 'chevre_alpine', nom: 'Chèvre Alpine' })).toBe(0.15)
    expect(ugbParTete({ id: 'cochon_large_white', nom: 'Cochon Large White' })).toBe(0.3)
    expect(ugbParTete({ id: 'ane', nom: 'Âne' })).toBe(0.8)
    expect(ugbParTete({ id: 'poney', nom: 'Poney' })).toBe(0.8)
    expect(ugbParTete({ id: 'vache_jersiaise', nom: 'Vache Jersiaise' })).toBe(1)
  })

  it('reconnaît un profil personnel à ses mots, accents repliés', () => {
    expect(ugbParTete({ id: 'mes_brebis', nom: 'Mes brebis' })).toBe(0.15)
    expect(ugbParTete({ id: 'troupeau_2026', nom: 'Chèvres du haut' })).toBe(0.15)
    expect(ugbParTete({ id: 'x', nom: 'Ânes de bât' })).toBe(0.8)
    expect(ugbParTete({ id: 'x', nom: 'Porcs gascons' })).toBe(0.3)
  })

  it('garde le coefficient des petits animaux, sans faux ami', () => {
    expect(ugbParTete({ id: 'poule_pondeuse', nom: 'Poule pondeuse' })).toBe(UGB_PAR_DEFAUT)
    expect(ugbParTete({ id: 'cobaye', nom: "Cochon d'Inde" })).toBe(UGB_PAR_DEFAUT)
    expect(ugbParTete({ id: 'x', nom: 'Canards de Barbarie' })).toBe(UGB_PAR_DEFAUT)
  })
})
