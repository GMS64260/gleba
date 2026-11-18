/**
 * Nappe la plus proche (`fetchNappeInfo`, revue du 2026-11-11). Les stations
 * sont un extrait d'une réponse réelle de Hub'Eau (données publiques) autour
 * d'un point du Cher : 264 stations dans la boîte de 100 km, dont beaucoup
 * arrêtées depuis des années.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ lu: vi.fn(), range: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { genericCache: { findUnique: m.lu, upsert: m.range } } }))

import { fetchNappeInfo } from '@/lib/hubeau'
import { __resetEtatsMemoire } from '@/lib/cache-helper'

const POINT = { lat: 47.08, lng: 2.4 }

// Forme réelle : `altitude_station` arrive en chaîne, `date_fin_mesure` peut manquer.
const STATIONS = [
  { code_bss: '05483X0041/P210', altitude_station: '176.05', nom_departement: 'Nièvre', profondeur_investigation: 4.75, date_fin_mesure: '2011-03-17', nom_commune: 'Saincaize-Meauce', x: 3.067608283, y: 46.891482319 },
  { code_bss: '05742X0022/861', altitude_station: '186.0', nom_departement: 'Allier', profondeur_investigation: null, date_fin_mesure: null, nom_commune: 'Le Veurdre', x: 3.039823373, y: 46.756103434 },
  { code_bss: '03646X0086/F1', altitude_station: '129.0', nom_departement: 'Loiret', profondeur_investigation: 67.3, date_fin_mesure: '2026-11-03', nom_commune: 'Vitry-aux-Loges', x: 2.30815915, y: 47.914524773 },
  { code_bss: '05716X0008/F1', altitude_station: '184.65', nom_departement: 'Indre', profondeur_investigation: 131.7, date_fin_mesure: '2026-11-06', nom_commune: 'Nohant-Vic', x: 1.959874698, y: 46.638596213 },
  { code_bss: '04002X0015/F1', altitude_station: '135.0', nom_departement: 'Loiret', profondeur_investigation: 60.05, date_fin_mesure: '1974-03-22', nom_commune: 'Varennes-Changy', x: 2.655254161, y: 47.86274443 },
]

const mesure = (date: string, niveau: number | null) => ({ date_mesure: date, niveau_nappe_eau: niveau, profondeur_nappe: 12, qualification: 'Correcte' })

type Reponse = { ok: boolean; status: number; json: () => Promise<unknown> }
const ok = (json: unknown): Reponse => ({ ok: true, status: 200, json: async () => json })

/** `fetch` simulé de Hub'Eau : aucune requête réelle. */
function simulerHubEau(opts: {
  stations?: () => Promise<Reponse>
  chroniques?: (codeBss: string) => Promise<Reponse>
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- second argument typé pour lire `mock.calls`
  const f = vi.fn(async (url: string, _init?: RequestInit) => {
    const u = new URL(String(url))
    if (u.pathname.endsWith('/stations')) {
      return (opts.stations ?? (async () => ok({ count: STATIONS.length, next: null, data: STATIONS })))()
    }
    const code = u.searchParams.get('code_bss') ?? ''
    return (opts.chroniques ?? (async () => ok({ data: [mesure('2026-11-06', 171.2), mesure('2026-11-05', 171.2)] })))(code)
  })
  vi.stubGlobal('fetch', f)
  return f
}

const appelsChroniques = (f: ReturnType<typeof simulerHubEau>) =>
  f.mock.calls.map(([url]) => new URL(String(url))).filter((u) => u.pathname.endsWith('/chroniques')).map((u) => u.searchParams.get('code_bss'))

beforeEach(() => {
  vi.clearAllMocks()
  __resetEtatsMemoire()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'))
  m.lu.mockResolvedValue(null)
  // Comme Prisma : une colonne JSON obligatoire refuse `null`.
  m.range.mockImplementation(async ({ create }: { create: { data: unknown } }) => {
    if (create.data === null) throw new Error('Argument `data` must not be null')
    return {}
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('fetchNappeInfo', () => {
  it('retient la station en service la plus proche, sans interroger les stations arrêtées', async () => {
    const f = simulerHubEau({})
    const info = await fetchNappeInfo(POINT.lat, POINT.lng)
    // Saincaize-Meauce (55 km) est la plus proche mais arrêtée depuis 2011.
    expect(info?.station).toMatchObject({ code_bss: '05716X0008/F1', nom_commune: 'Nohant-Vic', altitude_station: 184.65 })
    expect(appelsChroniques(f)).toEqual(['05716X0008/F1'])
  })

  it('demande une page assez large pour couvrir la boîte, avec la date de fin de mesure', async () => {
    const f = simulerHubEau({})
    await fetchNappeInfo(POINT.lat, POINT.lng)
    const stations = new URL(String(f.mock.calls[0][0]))
    expect(Number(stations.searchParams.get('size'))).toBeGreaterThanOrEqual(500)
    expect(stations.searchParams.get('fields')).toContain('date_fin_mesure')
  })

  it('aucune station : rend null, et ce résultat se range en cache', async () => {
    simulerHubEau({ stations: async () => ok({ count: 0, next: null, data: [] }) })
    await expect(fetchNappeInfo(POINT.lat, POINT.lng)).resolves.toBeNull()
    expect(m.range).toHaveBeenCalledTimes(1)
    expect(m.range.mock.calls[0][0].create.data).not.toBeNull()
  })

  it('un résultat « aucune station » relu du cache reste null', async () => {
    simulerHubEau({ stations: async () => ok({ count: 0, next: null, data: [] }) })
    await fetchNappeInfo(POINT.lat, POINT.lng)
    const range = m.range.mock.calls[0][0].create
    m.lu.mockResolvedValue({ key: range.key, data: range.data, expiresAt: new Date('2026-11-11T16:00:00Z') })
    const f = simulerHubEau({})
    await expect(fetchNappeInfo(POINT.lat, POINT.lng)).resolves.toBeNull()
    expect(f).not.toHaveBeenCalled()
  })

  it('panne de Hub’Eau (HTTP ou réseau) : une erreur reconnaissable, pas « aucune station »', async () => {
    simulerHubEau({ stations: async () => ({ ok: false, status: 502, json: async () => ({}) }) })
    await expect(fetchNappeInfo(POINT.lat, POINT.lng)).rejects.toMatchObject({ name: 'HubEauIndisponibleError' })

    __resetEtatsMemoire()
    simulerHubEau({ stations: async () => { throw new TypeError('fetch failed') } })
    await expect(fetchNappeInfo(POINT.lat, POINT.lng)).rejects.toMatchObject({ name: 'HubEauIndisponibleError' })

    // Les relevés en panne pour toutes les stations : même chose, et rien n'est
    // rangé pour six heures.
    __resetEtatsMemoire()
    simulerHubEau({ chroniques: async () => ({ ok: false, status: 503, json: async () => ({}) }) })
    await expect(fetchNappeInfo(POINT.lat, POINT.lng)).rejects.toMatchObject({ name: 'HubEauIndisponibleError' })
    expect(m.range).not.toHaveBeenCalled()
  })

  it('un relevé sans niveau ne compte pas pour 0 m dans la tendance', async () => {
    const jours = ['06', '05', '04', '03', '02', '01']
    simulerHubEau({ chroniques: async () => ok({ data: [
      mesure('2026-11-06', 171.2), mesure('2026-11-05', null),
      ...jours.slice(2).map((j) => mesure(`2026-11-${j}`, 171.2)),
      ...['31', '30', '29', '28'].map((j) => mesure(`2026-10-${j}`, 171.2)),
    ] }) })
    const info = await fetchNappeInfo(POINT.lat, POINT.lng)
    expect(info).toMatchObject({ tendance: 'stable', niveauActuel: 171.2 })
  })
})
