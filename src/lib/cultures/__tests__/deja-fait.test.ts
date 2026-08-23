import { describe, expect, it } from 'vitest'
import { cocherApresSaisieManuelle, etapeDejaRealisable } from '../deja-fait'

/**
 * Friction 2026-08-23 : les formulaires de création proposent « déjà fait »
 * quand la date rend l'étape réalisable, et ne pré-cochent que sur une saisie
 * manuelle d'une date strictement passée. Comparaisons en journées civiles
 * locales, comme execution.ts.
 */
describe('etapeDejaRealisable', () => {
  const maintenant = new Date(2026, 7, 23, 10, 0) // 23/08/2026 10:00 local

  it('vrai pour une date passée', () => {
    expect(etapeDejaRealisable(new Date(2026, 7, 20, 8, 0), maintenant)).toBe(true)
  })

  it('vrai pour une date du jour, quelle que soit son heure', () => {
    expect(etapeDejaRealisable(new Date(2026, 7, 23, 0, 0), maintenant)).toBe(true)
    expect(etapeDejaRealisable(new Date(2026, 7, 23, 23, 59), maintenant)).toBe(true)
  })

  it('faux pour une date future, dès le lendemain civil', () => {
    expect(etapeDejaRealisable(new Date(2026, 7, 24, 0, 1), maintenant)).toBe(false)
  })

  it('faux sans date exploitable', () => {
    expect(etapeDejaRealisable(null, maintenant)).toBe(false)
    expect(etapeDejaRealisable(undefined, maintenant)).toBe(false)
    expect(etapeDejaRealisable('', maintenant)).toBe(false)
    expect(etapeDejaRealisable('pas-une-date', maintenant)).toBe(false)
  })

  it('accepte la chaîne « YYYY-MM-DD » des inputs type=date', () => {
    expect(etapeDejaRealisable('2020-01-01', maintenant)).toBe(true)
    expect(etapeDejaRealisable('2100-01-01', maintenant)).toBe(false)
  })
})

describe('cocherApresSaisieManuelle', () => {
  const maintenant = new Date(2026, 7, 23, 10, 0)

  it('pré-coche une date strictement passée (antidater = enregistrer l’histoire)', () => {
    expect(cocherApresSaisieManuelle(new Date(2026, 7, 22, 18, 0), maintenant)).toBe(true)
  })

  it('ne pré-coche PAS une date du jour (« je sème cet après-midi » reste possible)', () => {
    expect(cocherApresSaisieManuelle(new Date(2026, 7, 23, 0, 0), maintenant)).toBe(false)
  })

  it('ne pré-coche jamais une date future ou absente', () => {
    expect(cocherApresSaisieManuelle(new Date(2026, 7, 25, 8, 0), maintenant)).toBe(false)
    expect(cocherApresSaisieManuelle(null, maintenant)).toBe(false)
    expect(cocherApresSaisieManuelle('', maintenant)).toBe(false)
  })
})
