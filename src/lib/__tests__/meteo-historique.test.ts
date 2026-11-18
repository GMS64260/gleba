/**
 * Historique météo d'une parcelle (`getMeteoHistorique`) : une prévision ou
 * une archive encore provisoire ne devient jamais un jour définitif (revue du
 * 2026-10-28, témoin meteo-historique).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ cached: vi.fn(), parcelle: vi.fn(), upsert: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { meteoCache: { findUnique: m.cached, upsert: m.upsert }, parcelleGeo: { findFirst: m.parcelle } } }))
vi.mock('@/lib/cache-helper', () => ({ getOrFetch: async (_: string, charger: () => Promise<unknown>) => charger() }))
import { getMeteoHistorique, getPrecipitationsRecentes } from '@/lib/meteo'

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

  // Revue du 2026-11-11 : la boucle avançait en heure locale et lisait le jour
  // en UTC ; au passage à l'heure d'été (Europe/Paris), le 29 mars sortait
  // deux fois et le dernier jour manquait.
  it('une période qui traverse le passage à l’heure d’été lit chaque jour une fois', async () => {
    vi.setSystemTime(new Date('2026-05-20T10:00:00Z'))
    m.cached.mockImplementation(async ({ where }: { where: { lat_lng_date_source: { date: Date } } }) => {
      const jour = where.lat_lng_date_source.date
      return { ...ligne(jour.toISOString().slice(0, 10), '2026-05-01T08:00:00Z', 1), date: jour }
    })
    vi.stubGlobal('fetch', archive(0))
    const h = await getMeteoHistorique('p1', 'ferme-synthetique', '2026-03-27', '2026-04-01')
    expect(h?.donnees.map((j) => j.date)).toEqual([
      '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01',
    ])
    expect(fetch).not.toHaveBeenCalled()
  })

  // Un jour que l'archive n'a pas encore publié n'a ni pluie ni température :
  // rangé en base, il ressortait « 0 mm, 0 °C » sans son drapeau.
  it('un jour pas encore publié par l’archive n’est pas rangé en base', async () => {
    m.cached.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ daily: {
      time: ['2026-07-18', '2026-07-19'], temperature_2m_min: [10, null], temperature_2m_max: [20, null], precipitation_sum: [3, null],
      et0_fao_evapotranspiration: [2, null], shortwave_radiation_sum: [5, null], sunshine_duration: [3600, null],
      relative_humidity_2m_min: [60, null], relative_humidity_2m_max: [90, null], wind_speed_10m_max: [10, null],
    } }) })))
    const h = await getMeteoHistorique('p1', 'ferme-synthetique', '2026-07-18', '2026-07-19')
    expect(h?.donnees).toHaveLength(2)
    expect(h?.donnees[1]).toMatchObject({ precipitationInconnue: true, ensoleillementInconnu: true })
    const ranges = m.upsert.mock.calls.map(([arg]) => arg.create.date.toISOString().slice(0, 10))
    expect(ranges).toEqual(['2026-07-18'])
  })
})

describe('getPrecipitationsRecentes', () => {
  it('borne la plage au jour civil du serveur et ignore les jours pas encore publiés', async () => {
    // 0 h 30 à Paris le 20 : le jour UTC est encore le 19.
    vi.setSystemTime(new Date('2026-07-19T22:30:00Z'))
    const hierLocal = new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- argument typé pour lire `mock.calls`
    const appel = vi.fn(async (_url: string) => ({ ok: true, json: async () => ({ daily: {
      time: ['2026-07-17', '2026-07-18', '2026-07-19'], temperature_2m_min: [10, 10, null], temperature_2m_max: [20, 20, null],
      precipitation_sum: [0, 12, null], et0_fao_evapotranspiration: [2, 2, null], shortwave_radiation_sum: [5, 5, null],
      sunshine_duration: [3600, 3600, null], relative_humidity_2m_min: [60, 60, null], relative_humidity_2m_max: [90, 90, null],
      wind_speed_10m_max: [10, 10, null],
    } }) }))
    vi.stubGlobal('fetch', appel)
    const r = await getPrecipitationsRecentes(43.3, -0.4, 3)
    expect(new URL(String(appel.mock.calls[0][0])).searchParams.get('end_date')).toBe(hierLocal)
    // Le 19, pas encore publié, ne compte ni comme jour mesuré ni comme jour sec.
    expect(r).toMatchObject({ total: 12, jours: 2, joursSansPluie: 0 })
  })
})
