import { describe, expect, it } from 'vitest'
import { echeanceAncienne, lireJourRealisation } from './date-realisation'

describe('date réelle d’un soin coché « fait »', () => {
  const maintenant = new Date(2026, 10, 9, 10, 0, 0)

  it('ne demande la date que pour une échéance de plus d’un jour', () => {
    expect(echeanceAncienne(new Date(2026, 10, 9, 8, 0), maintenant)).toBe(false)
    expect(echeanceAncienne(new Date(2026, 10, 8, 18, 0), maintenant)).toBe(false)
    expect(echeanceAncienne(new Date(2026, 10, 3, 8, 0), maintenant)).toBe(true)
    expect(echeanceAncienne(new Date(2026, 10, 12), maintenant)).toBe(false)
    expect(echeanceAncienne(null, maintenant)).toBe(false)
  })

  it('lit un jour saisi et refuse l’invalide ou le futur', () => {
    expect(lireJourRealisation('03/11/2026', maintenant)).toEqual(new Date(2026, 10, 3, 12))
    expect(lireJourRealisation(' 3-11-2026 ', maintenant)).toEqual(new Date(2026, 10, 3, 12))
    expect(lireJourRealisation('2026-11-03', maintenant)).toEqual(new Date(2026, 10, 3, 12))
    expect(lireJourRealisation('09/11/2026', maintenant)).toEqual(new Date(2026, 10, 9, 12))
    expect(lireJourRealisation('31/02/2026', maintenant)).toBeNull()
    expect(lireJourRealisation('10/11/2026', maintenant)).toBeNull()
    expect(lireJourRealisation('mardi', maintenant)).toBeNull()
  })
})
