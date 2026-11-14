import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ forecast: vi.fn(), history: vi.fn(), coords: vi.fn() }))
vi.mock('@/lib/meteo', () => ({ fetchOpenMeteoForecast: m.forecast, fetchOpenMeteoHistory: m.history }))
vi.mock('@/lib/prisma', () => ({ default: { parcelleGeo: { findMany: m.coords } } }))
vi.mock('@/lib/abonnement/serveur', () => ({ serviceAutorise: async () => true }))
vi.mock('@/lib/irrigation/a-arroser', () => ({ chargerArrosagesDuJour: vi.fn() }))

import { fetchMeteoParCoord, recupererAlertesMeteoJour } from './queries'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  // Déjà le 21 à Paris, encore le 20 en UTC.
  vi.setSystemTime(new Date('2026-07-20T22:30:00Z'))
  m.history.mockResolvedValue([{ date: '2026-07-19', precipitation: 3 }])
  m.coords.mockResolvedValue([{ centroidLat: 43, centroidLng: 1 }])
})
afterEach(() => vi.useRealTimers())

describe('pluie du jour des notifications', () => {
  it('additionne l’historique et le jour daté d’aujourd’hui, même si daily commence hier', async () => {
    m.forecast.mockResolvedValue({ daily: [
      { date: '2026-07-20', precipitation: 40 },
      { date: '2026-07-21', precipitation: 7 },
    ] })
    const meteo = await fetchMeteoParCoord([{ lat: 43, lng: 1 }])
    expect([...meteo.pluieRecente3jParCoord.values()]).toEqual([10])
    expect(m.history).toHaveBeenCalledWith(43, 1, '2026-07-18', '2026-07-20')
  })

  it('n’utilise pas la veille si le jour courant est absent', async () => {
    m.forecast.mockResolvedValue({ daily: [{ date: '2026-07-20', precipitation: 40 }] })
    const meteo = await fetchMeteoParCoord([{ lat: 43, lng: 1 }])
    expect([...meteo.pluieRecente3jParCoord.values()]).toEqual([3])
  })

  it('notifie la pluie de la date du jour, identique à celle affichée dans les prévisions', async () => {
    const conditions = { tempMin: 15, tempMax: 20, windSpeedMax: 5 }
    m.forecast.mockResolvedValue({ current: null, daily: [
      { ...conditions, date: '2026-07-20', precipitation: 40 },
      { ...conditions, date: '2026-07-21', precipitation: 30 },
    ] })
    const alertes = await recupererAlertesMeteoJour('ferme-fictive')
    expect(alertes).toEqual([expect.objectContaining({ type: 'pluie', date: '2026-07-21', message: expect.stringContaining('30 mm') })])
    expect(m.coords).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'ferme-fictive' }) }))
  })
})
