import { describe, expect, it } from 'vitest'
import {
  effacementSortieSiActif,
  erreurMereSortieAvantNaissance,
  merePresenteALaNaissance,
} from './sortie-animal'

describe('effacementSortieSiActif', () => {
  it("efface date, cause, motif et destination quand l'animal redevient actif", () => {
    expect(effacementSortieSiActif('actif')).toEqual({
      dateSortie: null,
      causeSortie: null,
      motifSortie: null,
      nExploitationDestination: null,
    })
  })

  it('ne touche à rien pour un autre statut ou un statut absent', () => {
    expect(effacementSortieSiActif('mort')).toEqual({})
    expect(effacementSortieSiActif(undefined)).toEqual({})
  })
})

describe('merePresenteALaNaissance', () => {
  const morte = { statut: 'mort', dateSortie: new Date('2026-03-15T00:00:00Z') }

  it('accepte une naissance antérieure ou du jour de la mort', () => {
    expect(merePresenteALaNaissance(morte, new Date('2025-03-08T00:00:00Z'))).toBe(true)
    expect(merePresenteALaNaissance(morte, '2026-03-15')).toBe(true)
  })

  it('refuse une naissance postérieure à la sortie', () => {
    expect(merePresenteALaNaissance(morte, '2026-03-16')).toBe(false)
  })

  it("n'exclut pas quand une date manque ou que la mère est active", () => {
    expect(merePresenteALaNaissance({ statut: 'mort', dateSortie: null }, '2026-09-01')).toBe(true)
    expect(merePresenteALaNaissance(morte, null)).toBe(true)
    expect(merePresenteALaNaissance({ statut: 'actif', dateSortie: null }, '2030-01-01')).toBe(true)
  })
})

describe('erreurMereSortieAvantNaissance', () => {
  it('nomme la sortie et les deux dates', () => {
    expect(
      erreurMereSortieAvantNaissance({ statut: 'vendu', dateSortie: '2026-03-15' }, '2026-04-02'),
    ).toBe('Filiation impossible : la mère proposée est vendue le 15/03/2026, avant cette naissance (02/04/2026)')
  })

  it('retourne null quand la filiation est plausible', () => {
    expect(erreurMereSortieAvantNaissance({ statut: 'mort', dateSortie: '2026-03-15' }, '2025-03-08')).toBeNull()
  })
})
