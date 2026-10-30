/**
 * Conseiller d'irrigation (`GET /api/meteo/irrigation`) : une panne météo ne
 * doit jamais se lire « aucune culture » (revue du 2026-10-28, témoin
 * irrigation-indisponible).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ cultures: vi.fn(), parcelle: vi.fn(), meteo: vi.fn(), cacheSet: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { culture: { findMany: m.cultures }, parcelleGeo: { findFirst: m.parcelle } } }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-synthetique' } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock('@/lib/irrigation/meteo-bilan', async (original) => ({
  ...(await original<typeof import('@/lib/irrigation/meteo-bilan')>()),
  chargerMeteoBilan: m.meteo,
  debutArrosagesBilan: () => new Date('2026-01-01'),
  jourLocalIso: (d: Date) => d.toISOString().slice(0, 10),
}))
vi.mock('@/lib/irrigation/arrosages-saisis', () => ({ chargerArrosagesSaisis: async () => new Map(), dernierArrosage: () => null }))
// Le reste du module (repli sans météo) est le vrai : même règle que les tâches.
vi.mock('@/lib/irrigation-conseil', async (original) => ({
  ...(await original<typeof import('@/lib/irrigation-conseil')>()),
  whereCulturesEnPlace: () => ({}),
}))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCacheKey: () => 'synthetique', irrigationCache: { get: () => null, set: m.cacheSet } }))
import { GET } from './route'

const jour = (i: number) => new Date(Date.UTC(2026, 6, 20 + i)).toISOString().slice(0, 10)
const meteoSeche = {
  historique: Array.from({ length: 30 }, (_, i) => ({ date: jour(i - 30), pluie: 0, et0: 5 })),
  aujourdhui: { date: jour(0), pluie: 0, et0: 5 },
  previsions: Array.from({ length: 7 }, (_, i) => ({ date: jour(i + 1), pluie: 0, et0: 5 })),
  decalageUtcS: 7200,
}

function culture(id: number, plancheId: string, lat: number | null) {
  return {
    id,
    especeId: 'tomate',
    espece: { id: 'tomate', nom: 'Tomate', besoinEau: 5, vivace: false },
    variete: null,
    dateSemis: new Date('2026-04-01'),
    datePlantation: new Date('2026-05-15'),
    semisFait: true,
    plantationFaite: true,
    dateRecolte: null,
    finRecolte: null,
    derniereIrrigation: null,
    planche: {
      id: plancheId,
      nom: `Planche ${plancheId}`,
      type: 'Plein champ',
      irrigation: null,
      surface: 10,
      largeur: null,
      longueur: null,
      retentionEau: null,
      typeSol: 'Limoneux',
      parcelleGeo: lat === null ? null : { id: `parcelle-${plancheId}`, centroidLat: lat, centroidLng: -0.4, typeSol: 'Limon' },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.cultures.mockResolvedValue([culture(1, 'p1', 43.3)])
  m.parcelle.mockResolvedValue({ centroidLat: 43.3, centroidLng: -0.4, typeSol: 'Limon' })
})

describe('GET /api/meteo/irrigation', () => {
  it('une culture active avec une météo indisponible ne doit pas devenir une absence de cultures (HTTP 200)', async () => {
    m.meteo.mockResolvedValue(null)
    const res = await GET(new NextRequest('https://exemple.invalid/api/meteo/irrigation?refresh=1'))
    const json = await res.json()
    // Réponse attendue : indisponibilité explicite, pas un succès vide que le
    // composant traduit en « Aucune culture active nécessitant une analyse ».
    expect(res.status === 503 || json.indisponible === true || json.recommandations.length > 0).toBe(true)
    expect(json.indisponible).toBe(true)
    expect(json.zonesIndisponibles).toBe(1)
    expect(json.culturesSansMeteo).toBe(1)
    expect(json.totalCultures).toBe(1)
    expect(json.recommandations).toHaveLength(1)
    const reco = json.recommandations[0]
    expect(reco.sansMeteo).toBe('meteo-indisponible')
    // Jamais une tâche sans météo, et l'écran dit pourquoi.
    expect(['critique', 'haute']).not.toContain(reco.urgence)
    expect(reco.conseilMessage).toContain('Météo momentanément indisponible')
    expect(reco.conseilQuantite).toBe(0)
    // Une panne ne se fige pas deux minutes : le prochain affichage recalcule.
    expect(m.cacheSet).not.toHaveBeenCalled()
  })

  it('panne partielle : les cultures de la zone muette restent listées, à côté de celles calculées', async () => {
    m.cultures.mockResolvedValue([culture(1, 'p1', 43.3), culture(2, 'p2', 45.1)])
    m.meteo.mockImplementation(async (lat: number) => (lat < 44 ? meteoSeche : null))
    const json = await (await GET(new NextRequest('https://exemple.invalid/api/meteo/irrigation?refresh=1'))).json()
    expect(json.indisponible).toBe(false)
    expect(json.zonesIndisponibles).toBe(1)
    expect(json.culturesSansMeteo).toBe(1)
    expect(json.totalCultures).toBe(2)
    const parPlanche = new Map(json.recommandations.map((r: { plancheId: string }) => [r.plancheId, r]))
    expect(parPlanche.get('p1')).toMatchObject({ urgence: 'critique', sansMeteo: null })
    expect(parPlanche.get('p2')).toMatchObject({ sansMeteo: 'meteo-indisponible', conseilQuantite: 0 })
    expect(json.urgentes).toBe(1)
    expect(m.cacheSet).not.toHaveBeenCalled()
  })

  it('sans parcelle géolocalisée, la culture reste listée avec l’invitation à géolocaliser', async () => {
    m.cultures.mockResolvedValue([culture(1, 'p1', null)])
    m.parcelle.mockResolvedValue(null)
    const json = await (await GET(new NextRequest('https://exemple.invalid/api/meteo/irrigation?refresh=1'))).json()
    expect(m.meteo).not.toHaveBeenCalled()
    expect(json.indisponible).toBe(false)
    expect(json.zonesIndisponibles).toBe(0)
    expect(json.recommandations).toHaveLength(1)
    expect(json.recommandations[0].sansMeteo).toBe('sans-coordonnees')
    expect(json.recommandations[0].conseilMessage).toContain('Géolocalisez une parcelle')
  })

  it('météo disponible partout : calcul complet, mis en cache', async () => {
    m.meteo.mockResolvedValue(meteoSeche)
    const json = await (await GET(new NextRequest('https://exemple.invalid/api/meteo/irrigation?refresh=1'))).json()
    expect(json).toMatchObject({ indisponible: false, zonesIndisponibles: 0, culturesSansMeteo: 0, totalCultures: 1, urgentes: 1 })
    expect(json.recommandations[0].sansMeteo).toBeNull()
    expect(m.cacheSet).toHaveBeenCalledTimes(1)
  })
})
