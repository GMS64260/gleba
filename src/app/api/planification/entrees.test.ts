/**
 * Revue du 2026-11-11 — entrées des routes de planification : une année
 * illisible ne part plus en base (NaN → 500 Prisma), un regroupement inconnu
 * n'est plus pris pour « semaine », le lot de création est borné.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  stats: vi.fn(),
  semences: vi.fn(),
  plants: vi.fn(),
  prevues: vi.fn(),
  recoltes: vi.fn(),
  lot: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'u1' } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock('@/lib/planification', () => ({
  getStatsPlanification: m.stats,
  getBesoinsSemences: m.semences,
  getBesoinsPlants: m.plants,
  getCulturesPrevuesEtEtapesNonSuivies: m.prevues,
  getRecoltesPrevuesDetail: m.recoltes,
  creerCulturesBatch: m.lot,
}))
vi.mock('@/lib/kpi', () => ({
  getKpiMaraichage: async () => ({ surfacePlanifieeM2: 0, surfaceCultiveeM2: 0 }),
  invalidateKpi: m.invalidateKpi,
}))
vi.mock('@/lib/kpi/recoltes-annee', () => ({
  getRecoltesAnneeAggregat: async () => ({ realiseesKg: 0, projectionKg: 0, totalAttenduKg: 0, realiseesParUnite: {} }),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    espece: { findMany: async () => [] },
    variete: { findMany: async () => [] },
    iTP: { findMany: async () => [] },
  },
}))

import { GET as getStats } from './stats/route'
import { GET as getSemences } from './semences/route'
import { GET as getPlants } from './plants/route'
import { GET as getPrevues } from './cultures-prevues/route'
import { GET as getRecoltes } from './recoltes-prevues/route'
import { POST as postLot } from './creer-cultures/route'

const req = (chemin: string) => new NextRequest(`http://localhost/api/planification/${chemin}`)
const anneeCourante = new Date().getFullYear()

beforeEach(() => {
  vi.clearAllMocks()
  m.stats.mockResolvedValue({})
  m.semences.mockResolvedValue([])
  m.plants.mockResolvedValue([])
  m.prevues.mockResolvedValue({ cultures: [], etapesNonSuivies: [] })
  m.recoltes.mockResolvedValue({
    periodes: [],
    projectionCreeesKg: 0,
    projectionSuggestionsKg: 0,
    projectionCreeesParUnite: {},
    projectionSuggestionsParUnite: {},
  })
  m.lot.mockResolvedValue({ created: 1, cultures: [{ id: 1, plancheId: 'A1', especeId: 'Radis' }], ignorees: [] })
})

describe('paramètre annee illisible', () => {
  const routes = [
    ['stats', getStats, m.stats],
    ['semences', getSemences, m.semences],
    ['plants', getPlants, m.plants],
    ['cultures-prevues', getPrevues, m.prevues],
    ['recoltes-prevues', getRecoltes, m.recoltes],
  ] as const

  it.each(routes)('%s retombe sur l’année courante au lieu de transmettre NaN', async (chemin, GET, calcul) => {
    const res = await GET(req(`${chemin}?annee=abc`))
    expect(res.status).toBe(200)
    expect(calcul.mock.calls[0][1]).toBe(anneeCourante)
    expect((await res.json()).annee).toBe(anneeCourante)
  })

  it.each(routes)('%s garde l’année demandée', async (chemin, GET, calcul) => {
    await GET(req(`${chemin}?annee=2028`))
    expect(calcul.mock.calls[0][1]).toBe(2028)
  })
})

describe('regroupements', () => {
  it('récoltes prévues : une valeur inconnue vaut « mois », pas « semaine »', async () => {
    const res = await getRecoltes(req('recoltes-prevues?annee=2026&groupBy=trimestre'))
    expect(m.recoltes.mock.calls[0][2]).toBe('mois')
    expect((await res.json()).groupBy).toBe('mois')

    await getRecoltes(req('recoltes-prevues?annee=2026&groupBy=semaine'))
    expect(m.recoltes.mock.calls[1][2]).toBe('semaine')
  })

  it('cultures prévues : une valeur inconnue vaut « espece »', async () => {
    const res = await getPrevues(req('cultures-prevues?annee=2026&groupBy=n-importe'))
    expect((await res.json()).groupBy).toBe('espece')
  })
})

describe('Semences : bandeaux bornés aux lignes des trois onglets', () => {
  const besoin = (extra: Record<string, unknown>) => ({
    especeId: 'Menthe',
    varieteId: null,
    mode: 'bouture',
    statut: 'DONNEE_MANQUANTE',
    nbPlants: 10,
    grainesNecessaires: 0,
    besoinCaieux: 0,
    aCommander: 0,
    caieuxACommander: 0,
    stockDateMaj: null,
    ...extra,
  })

  it('une espèce sans onglet (bouture) n’alimente pas « dose manquante » ni « surface manquante »', async () => {
    m.semences.mockResolvedValue([
      besoin({}),
      besoin({ especeId: 'Vigne', statut: 'SURFACE_MANQUANTE' }),
      besoin({ especeId: 'Carotte', mode: 'graine_directe' }),
    ])
    const { stats } = await (await getSemences(req('semences?annee=2026'))).json()

    expect(stats.especesDonneeManquante).toEqual(['Carotte'])
    expect(stats.nbDonneeManquante).toBe(1)
    expect(stats.nbSurfaceManquante).toBe(0)
    // Elles restent nommées par leur propre bandeau.
    expect(stats.especesModeNonListe).toEqual(['Menthe', 'Vigne'])
  })
})

describe('POST creer-cultures', () => {
  const post = (body: unknown) =>
    postLot(new NextRequest('http://localhost/api/planification/creer-cultures', { method: 'POST', body: JSON.stringify(body) }))
  const ligne = { plancheId: 'A1', itpId: 'Radis-printemps', annee: 2027 }

  it.each([
    ['année non entière', [{ ...ligne, annee: 2027.5 }]],
    ['année hors bornes', [{ ...ligne, annee: 1500 }]],
    ['identifiant vide', [{ ...ligne, itpId: '' }]],
    ['lot démesuré', Array.from({ length: 501 }, () => ligne)],
  ])('refuse en 400 : %s', async (_cas, cultures) => {
    const res = await post({ cultures })
    expect(res.status).toBe(400)
    expect(m.lot).not.toHaveBeenCalled()
  })

  it('périme les indicateurs mémorisés du compte après une création', async () => {
    const res = await post({ cultures: [ligne] })
    expect(res.status).toBe(201)
    expect(m.invalidateKpi).toHaveBeenCalledWith('u1')
  })

  it('périme aussi les indicateurs quand le lot échoue', async () => {
    m.lot.mockRejectedValueOnce(new Error('transaction interrompue'))
    const res = await post({ cultures: [ligne] })
    expect(res.status).toBe(500)
    expect(m.invalidateKpi).toHaveBeenCalledWith('u1')
  })

  it('transmet les avertissements du lot', async () => {
    const avertissements = [{ plancheId: 'A1', itpId: 'x', message: 'Espacement entre rangs inconnu' }]
    m.lot.mockResolvedValueOnce({ created: 1, cultures: [], ignorees: [], avertissements })
    const res = await post({ cultures: [ligne] })
    expect((await res.json()).avertissements).toEqual(avertissements)
  })

  it('ne périme rien quand aucune culture n’est créée', async () => {
    m.lot.mockResolvedValue({ created: 0, cultures: [], ignorees: [{ plancheId: 'A1', itpId: 'x', motif: 'm' }] })
    await post({ cultures: [ligne] })
    expect(m.invalidateKpi).not.toHaveBeenCalled()
  })
})
