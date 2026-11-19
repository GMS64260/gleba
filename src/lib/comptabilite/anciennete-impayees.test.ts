import { describe, expect, it } from 'vitest'
import { ancienneteImpayee } from './anciennete-impayees'

describe(`Ancienneté des impayés — ${process.env.TZ}`, () => {
  it('vérifie le fuseau réellement appliqué aux dates', () => {
    if (process.env.TZ === 'Europe/Paris') {
      expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60)
      expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120)
    } else if (process.env.TZ === 'UTC') {
      expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0)
    }
  })

  it.each([0, 1, 6, 12, 23])('conserve le jour stocké à minuit UTC à %i h locales', (heure) => {
    const maintenant = new Date(2026, 10, 19, heure, 30)
    expect(ancienneteImpayee('2026-11-19T00:00:00.000Z', maintenant)).toBe(0)
    expect(ancienneteImpayee('2026-11-18', maintenant)).toBe(1)
    expect(ancienneteImpayee('2026-11-20T00:00:00.000Z', maintenant)).toBe(-1)
  })

  it('lit le jour local des vrais instants, y compris le soir et le minuit local', () => {
    const maintenant = new Date(2026, 6, 10, 0, 15)
    for (const heure of [0, 6, 12, 23]) {
      const instant = new Date(2026, 6, 10, heure, 1)
      expect(ancienneteImpayee(instant.toISOString(), maintenant)).toBe(0)
      expect(ancienneteImpayee(instant, maintenant)).toBe(0)
    }
    expect(ancienneteImpayee(new Date(2026, 6, 10), maintenant)).toBe(0)
  })

  it.each([
    ['2026-01-31', 2026, 1, 1],
    ['2026-12-31', 2027, 0, 1],
    ['2024-02-28', 2024, 1, 29],
    ['2024-02-29', 2024, 2, 1],
    ['2026-03-28', 2026, 2, 29],
    ['2026-03-29', 2026, 2, 30],
    ['2026-10-24', 2026, 9, 25],
    ['2026-10-25', 2026, 9, 26],
  ] as const)('compte un jour civil depuis %s jusqu’au lendemain', (piece, annee, mois, jour) => {
    expect(ancienneteImpayee(`${piece}T00:00:00.000Z`, new Date(annee, mois, jour, 0, 15))).toBe(1)
    expect(ancienneteImpayee(`${piece}T23:30:00`, new Date(annee, mois, jour, 0, 15))).toBe(1)
  })

  it('ne normalise pas silencieusement une date stockée invalide', () => {
    expect(ancienneteImpayee('2026-02-31', new Date(2026, 2, 1))).toBeNaN()
    expect(ancienneteImpayee('illisible', new Date(2026, 2, 1))).toBeNaN()
  })
})
