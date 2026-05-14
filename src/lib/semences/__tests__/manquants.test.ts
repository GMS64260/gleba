/**
 * BUG-15 — tests : breakdown manquants graines vs caïeux.
 */

import { describe, it, expect } from 'vitest'
import { computeManquantsBreakdown } from '../manquants'

describe('computeManquantsBreakdown (BUG-15)', () => {
  it('zéro quand aucun besoin', () => {
    expect(computeManquantsBreakdown([])).toEqual({
      nbMissingGraines: 0,
      nbMissingCaieux: 0,
      nbLowGraines: 0,
      nbLowCaieux: 0,
    })
  })

  it("reproduit le scénario Marc (6 graines manquantes + 2 caïeux manquants = header « 8 »)", () => {
    const besoins = [
      ...Array.from({ length: 6 }, () => ({ mode: 'graine_directe' as const, statut: 'MISSING' as const })),
      ...Array.from({ length: 2 }, () => ({ mode: 'bulbe_caieu' as const, statut: 'MISSING' as const })),
    ]
    const r = computeManquantsBreakdown(besoins)
    expect(r.nbMissingGraines).toBe(6)
    expect(r.nbMissingCaieux).toBe(2)
    expect(r.nbMissingGraines + r.nbMissingCaieux).toBe(8) // ce que disait le header
  })

  it('plant_repique compte côté graines (semence en pépinière)', () => {
    const besoins = [
      { mode: 'plant_repique' as const, statut: 'MISSING' as const },
      { mode: 'plant_repique' as const, statut: 'LOW' as const },
    ]
    const r = computeManquantsBreakdown(besoins)
    expect(r.nbMissingGraines).toBe(1)
    expect(r.nbLowGraines).toBe(1)
    expect(r.nbMissingCaieux).toBe(0)
    expect(r.nbLowCaieux).toBe(0)
  })

  it('bouture compte côté caïeux (unité, pas grammes)', () => {
    const besoins = [{ mode: 'bouture' as const, statut: 'MISSING' as const }]
    const r = computeManquantsBreakdown(besoins)
    expect(r.nbMissingCaieux).toBe(1)
    expect(r.nbMissingGraines).toBe(0)
  })

  it('ignore les statuts OK et IGNORE', () => {
    const besoins = [
      { mode: 'graine_directe' as const, statut: 'OK' as const },
      { mode: 'bulbe_caieu' as const, statut: 'IGNORE' as const },
    ]
    const r = computeManquantsBreakdown(besoins)
    expect(r.nbMissingGraines).toBe(0)
    expect(r.nbMissingCaieux).toBe(0)
    expect(r.nbLowGraines).toBe(0)
    expect(r.nbLowCaieux).toBe(0)
  })

  it('mélange complet : header somme bien les 4 catégories', () => {
    const besoins = [
      { mode: 'graine_directe' as const, statut: 'MISSING' as const },
      { mode: 'graine_directe' as const, statut: 'LOW' as const },
      { mode: 'bulbe_caieu' as const, statut: 'MISSING' as const },
      { mode: 'bulbe_caieu' as const, statut: 'LOW' as const },
      { mode: 'graine_directe' as const, statut: 'OK' as const },
    ]
    const r = computeManquantsBreakdown(besoins)
    expect(r).toEqual({
      nbMissingGraines: 1,
      nbMissingCaieux: 1,
      nbLowGraines: 1,
      nbLowCaieux: 1,
    })
  })
})
