import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAvailableYears } from './year-selector'

afterEach(() => vi.useRealTimers())

describe('années des sélecteurs partagés', () => {
  it('propose une récolte de 2019 même en 2026, sans borne fournie par la page', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T12:00:00Z'))
    const recolte = { date: new Date('2019-06-15T12:00:00Z') }
    expect(getAvailableYears()).toContain(recolte.date.getFullYear())
  })

  it('conserve les exercices anciens au changement d’année et la planification à N+1', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'))
    const annees = getAvailableYears()
    expect(annees[0]).toBe(2031)
    expect(annees.at(-1)).toBe(2000)
    expect(annees).toContain(2019)
    expect(annees).toEqual([...new Set(annees)].sort((a, b) => b - a))
  })

  it('respecte une borne explicite plus ancienne', () => {
    expect(getAvailableYears(1995)).toContain(1995)
    expect(getAvailableYears(1995)).not.toContain(1994)
  })
})
