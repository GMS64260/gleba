/**
 * BUG-10 — tests : `estimerNombrePlantsStrict` doit renvoyer null
 * quand un input manque (pour ne pas garder une valeur fantôme dans le form).
 */

import { describe, it, expect } from 'vitest'
import {
  estimerNombrePlants,
  estimerNombrePlantsStrict,
} from '../assistant-helpers'

describe('estimerNombrePlantsStrict (BUG-10)', () => {
  it('retourne null si longueur manque', () => {
    expect(estimerNombrePlantsStrict(null, 2, 30)).toBeNull()
    expect(estimerNombrePlantsStrict(0, 2, 30)).toBeNull()
    expect(estimerNombrePlantsStrict(undefined, 2, 30)).toBeNull()
  })

  it('retourne null si nbRangs manque', () => {
    expect(estimerNombrePlantsStrict(10, null, 30)).toBeNull()
    expect(estimerNombrePlantsStrict(10, 0, 30)).toBeNull()
  })

  it('retourne null si espacement manque ou ≤ 0', () => {
    expect(estimerNombrePlantsStrict(10, 2, null)).toBeNull()
    expect(estimerNombrePlantsStrict(10, 2, 0)).toBeNull()
    expect(estimerNombrePlantsStrict(10, 2, -5)).toBeNull()
  })

  it('calcule correctement avec tous les inputs', () => {
    // 25m, 2 rangs, espacement 50cm → 2 × floor(2500/50) = 100 plants
    expect(estimerNombrePlantsStrict(25, 2, 50)).toBe(100)
  })

  it('exemple Marc B4 petit pois : nbRangs vide + espacement vide → null (pas 30)', () => {
    // Scénario : longueur 25m mais nbRangs et espacement vides.
    expect(estimerNombrePlantsStrict(25, null, null)).toBeNull()
    expect(estimerNombrePlantsStrict(25, 0, 0)).toBeNull()
  })

  it("conserve l'ancien comportement de la version permissive (compat)", () => {
    // estimerNombrePlants (sans Strict) renvoie 0 quand input manque — utilisé
    // par l'assistant guidé qui s'attend à une valeur numérique pour calculer
    // un besoin de graines (0 plants → 0 besoins).
    expect(estimerNombrePlants(25, 1, 0, 30)).toBe(0)
    expect(estimerNombrePlants(25, 1, 2, 50)).toBe(100)
  })
})
