/**
 * QA cmsoeyth0 — règles d'exclusion d'un pollinisateur, partagées entre la
 * matrice de l'écran (compatibilités dérivées) et la garde serveur de
 * POST /api/arbres/pollinisation : un triploïde (pollen stérile) était
 * accepté comme pollinisateur « excellent », et un clone (même variété)
 * passait aussi.
 */
import { describe, expect, it, vi } from 'vitest'

// computePollinisationVerger vit dans le même module : on neutralise le
// client Prisma, seul raisonExclusionPollinisateur (pure) est testé ici.
vi.mock('@/lib/prisma', () => ({ default: {} }))

import { raisonExclusionPollinisateur } from '../pollinisation-verger'

describe('raisonExclusionPollinisateur', () => {
  it('exclut un pollinisateur triploïde (pollen stérile)', () => {
    expect(
      raisonExclusionPollinisateur({
        varietePollinise: 'golden',
        varietePollinisateur: 'jonagold',
        ploidiePollinisateur: 'triploïde',
      })
    ).toBe('triploide')
  })

  it('reconnaît la ploïdie quelle que soit la casse ou la forme', () => {
    for (const ploidie of ['Triploïde', 'TRIPLOIDE', 'triploid (3n)']) {
      expect(
        raisonExclusionPollinisateur({
          varietePollinise: null,
          varietePollinisateur: 'jonagold',
          ploidiePollinisateur: ploidie,
        })
      ).toBe('triploide')
    }
  })

  it('exclut la même variété (clone)', () => {
    expect(
      raisonExclusionPollinisateur({
        varietePollinise: 'golden',
        varietePollinisateur: 'golden',
        ploidiePollinisateur: 'diploïde',
      })
    ).toBe('meme_variete')
  })

  it('accepte un diploïde de variété différente', () => {
    expect(
      raisonExclusionPollinisateur({
        varietePollinise: 'golden',
        varietePollinisateur: 'reinette-grise',
        ploidiePollinisateur: 'diploïde',
      })
    ).toBeNull()
  })

  it('ne bloque pas quand la ploïdie ou les variétés sont inconnues', () => {
    expect(
      raisonExclusionPollinisateur({
        varietePollinise: null,
        varietePollinisateur: null,
        ploidiePollinisateur: null,
      })
    ).toBeNull()
    expect(
      raisonExclusionPollinisateur({
        varietePollinise: 'golden',
        varietePollinisateur: 'reinette-grise',
      })
    ).toBeNull()
  })
})
