/**
 * Historique météo d'une parcelle (`getMeteoHistorique`) : une prévision ou
 * une archive encore provisoire ne devient jamais un jour définitif (revue du
 * 2026-10-28, témoin meteo-historique).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ cached: vi.fn(), parcelle: vi.fn(), upsert: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { meteoCache: { findUnique: m.cached, upsert: m.upsert }, parcelleGeo: { findFirst: m.parcelle } } }))
vi.mock('@/lib/cache-helper', () => ({ getOrFetch: async (_: string, charger: () => Promise<unknown>) => charger() }))
import { getMeteoHistorique } from '@/lib/meteo'

const ligne = (date: string, createdAt: string, precipitation: number) => ({
  date: new Date(date), createdAt: new Date(createdAt), precipitation, tempMin: 12, tempMax: 25, tempMoy: 18, et0: 5,
})

function archive(pluie: number) {
  return vi.fn(async () => ({ ok: true, json: async () => ({ daily: {
    time: ['2026-07-19'], temperature_2m_min: [10], temperature_2m_max: [20], precipitation_sum: [pluie], et0_fao_evapotranspiration: [2],
    shortwave_radiation_sum: [5], sunshine_duration: [3600], relative_humidity_2m_min: [60], relative_humidity_2m_max: [90], wind_speed_10m_max: [10],
  } }) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-20T10:00:00Z'))
  m.parcelle.mockResolvedValue({ id: 'p1', nom: 'Parcelle synthétique', centroidLat: 43.3, centroidLng: -0.4 })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('getMeteoHistorique', () => {
  it('une prévision stockée hier pour hier doit être réconciliée avec l’archive, pas être rendue définitive', async () => {
    // Ligne écrite par la météo parcelle avant la correction : la prévision
    // du jour, rangée sous la même clé que les archives.
    m.cached.mockResolvedValue(ligne('2026-07-19', '2026-07-19T06:00:00Z', 0))
    const fetchArchive = archive(35)
    vi.stubGlobal('fetch', fetchArchive)
    const h = await getMeteoHistorique('p1', 'ferme-synthetique', '2026-07-19', '2026-07-19')
    expect(h?.donnees[0]?.precipitation).toBe(35)
    expect(fetchArchive).toHaveBeenCalledTimes(1)
  })

  it('une archive lue dans les jours qui suivent reste provisoire ; consolidée, elle sert sans appel', async () => {
    // Archive écrite le lendemain : peut porter les zéros d'un jour pas encore publié.
    m.cached.mockResolvedValue(ligne('2026-07-12', '2026-07-13T08:00:00Z', 0))
    vi.stubGlobal('fetch', archive(12))
    await getMeteoHistorique('p1', 'ferme-synthetique', '2026-07-12', '2026-07-12')
    expect(fetch).toHaveBeenCalledTimes(1)

    // Archive écrite une semaine après le jour : définitive.
    m.cached.mockResolvedValue(ligne('2026-07-12', '2026-07-19T08:00:00Z', 4))
    const sansAppel = archive(12)
    vi.stubGlobal('fetch', sansAppel)
    const h = await getMeteoHistorique('p1', 'ferme-synthetique', '2026-07-12', '2026-07-12')
    expect(sansAppel).not.toHaveBeenCalled()
    expect(h?.donnees[0]?.precipitation).toBe(4)
  })
})
