import { describe, expect, it } from 'vitest'

import {
  appliquerDecalageItp,
  decalageItpPourZone,
  itpApplicableAZone,
} from '@/lib/calendrier-climat'

describe('calage climatique des ITP', () => {
  it('affiche les références génériques et régionales dans les zones métropolitaines', () => {
    expect(itpApplicableAZone(null, 'oceanique')).toBe(true)
    expect(itpApplicableAZone('oceanique', 'mediterraneen')).toBe(true)
    expect(itpApplicableAZone('tropical_antilles', 'oceanique')).toBe(false)
  })

  it('réserve les calendriers tropicaux à leur zone exacte', () => {
    expect(itpApplicableAZone('tropical_antilles', 'tropical_antilles')).toBe(true)
    expect(itpApplicableAZone('equatorial', 'tropical_antilles')).toBe(false)
    expect(itpApplicableAZone(null, 'tropical_antilles')).toBe(false)
  })

  it('convertit le climat source vers le climat cible', () => {
    expect(decalageItpPourZone(null, 'semi_continental')).toBe(1)
    expect(decalageItpPourZone('oceanique', 'oceanique')).toBe(0)
    expect(decalageItpPourZone('oceanique', 'semi_continental')).toBe(2)
    expect(decalageItpPourZone('oceanique', 'mediterraneen')).toBe(-1)
    expect(decalageItpPourZone('tropical_antilles', 'tropical_antilles')).toBe(0)
  })

  it('décale ensemble les repères et les bornes des fenêtres', () => {
    expect(
      appliquerDecalageItp(
        {
          semaineSemis: 51,
          semainePlantation: null,
          semaineRecolte: 5,
          semaineImplantationDebut: 51,
          semaineImplantationFin: 2,
          semaineRecolteFin: 8,
        },
        2
      )
    ).toEqual({
      semaineSemis: 1,
      semainePlantation: null,
      semaineRecolte: 7,
      semaineImplantationDebut: 1,
      semaineImplantationFin: 4,
      semaineRecolteFin: 10,
    })
  })
})
