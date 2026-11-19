import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), animaux: vi.fn(), lots: vi.fn(), collectes: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ default: {
  animal: { findMany: mocks.animaux }, lotAnimaux: { findMany: mocks.lots },
  collecteLait: { findMany: mocks.collectes },
} }))
import { GET } from './route'

const especeAnimale = { nom: 'Brebis', production: 'lait', productions: [], categorieReglementaire: 'ovin' }
const cibles = [
  { id: 1, userId: 'ferme', statut: 'actif', nom: 'Active', identifiant: 'A', especeAnimale },
  { id: 2, userId: 'ferme', statut: 'vendu', nom: 'Sortie', identifiant: 'B', especeAnimale },
  { id: 3, userId: 'autre', statut: 'actif', nom: 'Autre', identifiant: 'C', especeAnimale },
  { id: 4, userId: 'ferme', statut: 'vendu', nom: 'Sans analyse', identifiant: 'D', especeAnimale },
]
const lots = [
  { id: 11, userId: 'ferme', statut: 'reforme', nom: 'Ancien lot', especeAnimale },
  { id: 12, userId: 'autre', statut: 'reforme', nom: 'Autre lot', especeAnimale },
  { id: 13, userId: 'ferme', statut: 'reforme', nom: 'TB seul', especeAnimale },
]
const mesure = (date: string, animalId: number | null, lotId: number | null, cellulesParMl: number | null = 600, userId = 'ferme') => ({
  date: new Date(date), animalId, lotId, cellulesParMl, mgGpl: 60, mpGpl: 45, userId,
})
let mesures: ReturnType<typeof mesure>[]

type WhereCible = { userId?: string; statut?: string; id?: { in: number[] }; OR?: WhereCible[] }
function correspond(cible: typeof cibles[number] | typeof lots[number], where: WhereCible): boolean {
  return (!where.userId || cible.userId === where.userId)
    && (!where.statut || cible.statut === where.statut)
    && (!where.id || where.id.in.includes(cible.id))
    && (!where.OR || where.OR.some(condition => correspond(cible, condition)))
}
async function lire(query = '') {
  const response = await GET(new NextRequest(`http://localhost/api/elevage/qualite-lait?${query}`))
  return { status: response.status, json: await response.json() }
}

describe('qualité du lait — bornes historiques et cloisonnement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-19T12:00:00Z'))
    mocks.auth.mockResolvedValue({ session: { user: { id: 'ferme' } }, error: null })
    mesures = [
      mesure('2020-05-10T12:00:00Z', 2, null, 500),
      mesure('2020-05-11T12:00:00Z', null, 11, 700),
      mesure('2026-11-19T22:59:59.999Z', 1, null, 300),
      mesure('2026-11-19T23:00:00Z', 1, null, 9000),
      mesure('2020-05-10T12:00:00Z', 3, null, 9900, 'autre'),
      mesure('2020-05-10T12:00:00Z', null, 12, 9900, 'autre'),
    ]
    mocks.animaux.mockImplementation(async ({ where }) => cibles.filter(c => correspond(c, where)))
    mocks.lots.mockImplementation(async ({ where }) => lots.filter(c => correspond(c, where)))
    mocks.collectes.mockImplementation(async ({ where }) => mesures.filter(m =>
      m.userId === where.userId
      && (!where.date.gte || m.date >= where.date.gte)
      && (!where.date.lt || m.date < where.date.lt)
      && (!where.date.lte || m.date <= where.date.lte),
    ))
  })
  afterEach(() => vi.useRealTimers())

  it('retrouve les mesures de plus de deux ans et les cibles sorties, sans autre exploitation', async () => {
    const { status, json } = await lire('start=2020-01-01&end=2020-12-31&fenetre=30')
    expect(status).toBe(200)
    expect(json.data.filter((c: { nbMesures: number }) => c.nbMesures > 0).map((c: { id: number }) => c.id).sort()).toEqual([11, 2])
    for (const id of [3, 4, 12]) expect(json.data.map((c: { id: number }) => c.id)).not.toContain(id)
    expect(json.troupeau).toMatchObject({ cellulesMoyennes: 600, nbAvecMesure: 2, fenetreJours: 366,
      periode: { mode: 'periode', start: '2020-01-01', end: '2020-12-31' } })
    for (const mock of [mocks.animaux, mocks.lots, mocks.collectes]) {
      expect(mock.mock.calls[0][0].where.userId).toBe('ferme')
    }
  })

  it('exclut demain par défaut, mais inclut toute la journée courante à Paris', async () => {
    const { json } = await lire()
    expect(json.troupeau.cellulesMoyennes).toBe(300)
    expect(json.data[0].nbMesures).toBe(1)
    expect(json.troupeau.fenetreJours).toBe(180)
    expect(json.troupeau.periode.end).toBe('2026-11-19')
  })

  it('start seul va jusqu’à aujourd’hui et ignore fenetre', async () => {
    const { json } = await lire('start=2020-05-11&fenetre=30')
    expect(json.troupeau.nbAvecMesure).toBe(2)
    expect(json.troupeau.cellulesMoyennes).toBe(500)
    expect(json.troupeau.periode).toEqual({ mode: 'periode', start: '2020-05-11', end: '2026-11-19' })
  })

  it('end seul lit tout l’historique avant sa fin inclusive', async () => {
    const { json } = await lire('end=2020-05-10')
    expect(json.troupeau.cellulesMoyennes).toBe(500)
    expect(json.troupeau.fenetreJours).toBeNull()
    expect(mocks.collectes.mock.calls[0][0].where.date.gte).toBeUndefined()
  })

  it('inclut un lot sorti portant uniquement un taux butyreux', async () => {
    mesures = [mesure('2020-05-10T12:00:00Z', null, 13, null)]
    const { json } = await lire('start=2020-05-10&end=2020-05-10')
    expect(json.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: 13, moyenneMg: 60 })]))
  })

  it('respecte une fin future explicitement demandée et renvoie une période vide sans mesures', async () => {
    const futur = await lire('start=2026-11-20&end=2026-11-20')
    expect(futur.json.troupeau.cellulesMoyennes).toBe(9000)
    mesures = []
    const vide = await lire('end=2010-01-01')
    expect(vide.status).toBe(200)
    expect(vide.json.troupeau).toMatchObject({ cellulesMoyennes: null, fenetreJours: null })
  })

  it.each([
    ['start=2020-02-30', 'start'], ['end=2021-02-29', 'end'],
    ['start=2020-13-01', 'start'], ['start=0120-01-01', 'start'], ['start=', 'start'], ['end=', 'end'],
    ['start=2020-01-01T00:00:00Z', 'start'],
    ['start=2020-05-12&end=2020-05-11', 'end'], ['start=2026-11-20', 'end'],
  ])('refuse les bornes invalides : %s', async (query, champ) => {
    const { status, json } = await lire(query)
    expect(status).toBe(400)
    expect(json).toEqual({ error: expect.any(String), champ })
    expect(mocks.collectes).not.toHaveBeenCalled()
    expect(mocks.animaux).not.toHaveBeenCalled()
    expect(mocks.lots).not.toHaveBeenCalled()
  })

  it.each([
    ['2026-03-29', '2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z'],
    ['2026-10-25', '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z'],
  ])('respecte la journée de changement d’heure %s', async (jour, debut, fin) => {
    mesures = [
      mesure(new Date(Date.parse(debut) - 1).toISOString(), 2, null, 9000),
      mesure(debut, 2, null, 500),
      mesure(new Date(Date.parse(fin) - 1).toISOString(), 2, null, 700),
      mesure(fin, 2, null, 9000),
    ]
    const { json } = await lire(`start=${jour}&end=${jour}`)
    expect(json.troupeau).toMatchObject({ cellulesMoyennes: 600, fenetreJours: 1 })
    expect(json.data.find((c: { id: number }) => c.id === 2).nbMesures).toBe(2)
  })

  it.each([['90', 90], ['180', 180], ['365', 365], ['1', 30], ['900', 730], ['abc', 180], ['0', 180]])(
    'conserve le mode fenetre=%s et ses limites', async (value, attendu) => {
      const { status, json } = await lire(`fenetre=${value}`)
      expect(status).toBe(200)
      expect(json.troupeau).toMatchObject({ fenetreJours: attendu, periode: { mode: 'fenetre', end: '2026-11-19' } })
    },
  )
})
