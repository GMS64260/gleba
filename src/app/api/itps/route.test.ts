import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  zoneEffectiveUser: vi.fn(),
  statsAvisPourRefs: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    iTP: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}))
vi.mock('@/lib/terroir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terroir')>()
  return { ...actual, zoneEffectiveUser: mocks.zoneEffectiveUser }
})
vi.mock('@/lib/avis/stats-liste', () => ({ statsAvisPourRefs: mocks.statsAvisPourRefs }))

import { ZONES_METROPOLE } from '@/lib/calendrier-climat'

import { GET } from './route'

/**
 * Aplatit l'arbre `where` (AND / OR imbriqués) en une liste de feuilles.
 *
 * Les assertions portaient sur la FORME exacte de l'arbre (`where.AND[0].actif`,
 * `where.AND[0].zoneClimat`) : elles cassaient dès qu'un filtre était factorisé
 * dans un helper partagé, sans rien dire de plus sur le comportement. On assure
 * désormais la présence des clauses, quelle que soit leur profondeur.
 */
function feuilles(where: unknown): Record<string, unknown>[] {
  if (!where || typeof where !== 'object') return []
  const noeud = where as Record<string, unknown>
  const enfants = [noeud.AND, noeud.OR, noeud.NOT]
    .flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))
    .flatMap((v) => feuilles(v))
  const propre = Object.fromEntries(
    Object.entries(noeud).filter(([cle]) => !['AND', 'OR', 'NOT'].includes(cle))
  )
  return Object.keys(propre).length > 0 ? [propre, ...enfants] : enfants
}

function contientClause(where: unknown, attendu: Record<string, unknown>): boolean {
  const cible = JSON.stringify(attendu)
  return feuilles(where).some((f) => JSON.stringify(f) === cible)
}

describe('GET /api/itps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'USER' } },
    })
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(0)
    mocks.zoneEffectiveUser.mockResolvedValue('oceanique')
  })

  it('borne la pagination, masque les scénarios inactifs et recherche dans la provenance', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/itps?page=0&pageSize=5000&search=INRAE')
    )

    expect(response.status).toBe(200)
    const args = mocks.findMany.mock.calls[0][0]
    expect(args.skip).toBe(0)
    expect(args.take).toBe(1000)
    expect(contientClause(args.where, { actif: true })).toBe(true)
    expect(
      contientClause(args.where, { nom: { contains: 'INRAE', mode: 'insensitive' } })
    ).toBe(true)
    expect(
      contientClause(args.where, { sourceReference: { contains: 'INRAE', mode: 'insensitive' } })
    ).toBe(true)
    // Visibilité communautaire : jamais le perso privé d'autrui.
    expect(contientClause(args.where, { userId: null })).toBe(true)
    expect(contientClause(args.where, { partageCommunaute: true })).toBe(true)
    expect(contientClause(args.where, { userId: 'user-1' })).toBe(true)
  })

  it('cherche aussi sur la clé normalisée, insensible à la ponctuation et aux accents', async () => {
    await GET(new NextRequest('http://localhost/api/itps?search=TEST-Marc-Phac%C3%A9lie'))

    const args = mocks.findMany.mock.calls[0][0]
    expect(contientClause(args.where, { nomNormalise: { contains: 'test marc phacelie' } })).toBe(
      true
    )
  })

  it("n'interroge pas la clé normalisée quand la saisie n'a aucun caractère signifiant", async () => {
    // `normalizeReferentielKey('---')` vaut '' et `contains: ''` rendait le
    // catalogue entier : chercher « - » listait les 773 itinéraires.
    await GET(new NextRequest('http://localhost/api/itps?search=---'))

    const args = mocks.findMany.mock.calls[0][0]
    expect(feuilles(args.where).some((f) => 'nomNormalise' in f)).toBe(false)
  })

  it('retient les références génériques et régionales en métropole', async () => {
    await GET(new NextRequest('http://localhost/api/itps?applicable=1'))

    const args = mocks.findMany.mock.calls[0][0]
    expect(contientClause(args.where, { zoneClimat: null })).toBe(true)
    expect(contientClause(args.where, { zoneClimat: { in: [...ZONES_METROPOLE] } })).toBe(true)
  })

  it('retient seulement la zone tropicale exacte outre-mer', async () => {
    mocks.zoneEffectiveUser.mockResolvedValue('tropical_antilles')

    await GET(new NextRequest('http://localhost/api/itps?applicable=1'))

    const args = mocks.findMany.mock.calls[0][0]
    expect(contientClause(args.where, { zoneClimat: 'tropical_antilles' })).toBe(true)
    expect(contientClause(args.where, { zoneClimat: null })).toBe(false)
  })

  it("calibre chaque scénario depuis son climat source vers celui de l'exploitation", async () => {
    mocks.zoneEffectiveUser.mockResolvedValue('semi_continental')
    mocks.findMany.mockResolvedValue([
      {
        id: 'inrae-1',
        userId: null,
        zoneClimat: 'oceanique',
        semaineSemis: 16,
        semainePlantation: 20,
        semaineRecolte: 36,
        semaineImplantationDebut: 16,
        semaineImplantationFin: 18,
        semaineRecolteFin: 40,
      },
    ])
    mocks.count.mockResolvedValue(1)

    const response = await GET(
      new NextRequest('http://localhost/api/itps?applicable=1&calibre=1')
    )
    const body = await response.json()

    expect(body.data[0]).toMatchObject({
      semaineSemis: 18,
      semainePlantation: 22,
      semaineRecolte: 38,
      semaineImplantationDebut: 18,
      semaineImplantationFin: 20,
      semaineRecolteFin: 42,
      decalageClimatiqueApplique: 2,
      zoneClimatCible: 'semi_continental',
    })
  })

  it("ne déplace pas les semaines d'un ITP personnel sans zone lu par son auteur", async () => {
    mocks.zoneEffectiveUser.mockResolvedValue('montagnard')
    mocks.findMany.mockResolvedValue([
      { id: 'perso-1', userId: 'user-1', zoneClimat: null, semaineSemis: 10, semaineRecolte: 30 },
    ])
    mocks.count.mockResolvedValue(1)

    const body = await (await GET(new NextRequest('http://localhost/api/itps?calibre=1'))).json()

    expect(body.data[0]).toMatchObject({
      semaineSemis: 10,
      semaineRecolte: 30,
      decalageClimatiqueApplique: 0,
    })
  })

  it("transpose en revanche l'ITP personnel d'un AUTRE membre, partagé sans zone", async () => {
    mocks.zoneEffectiveUser.mockResolvedValue('montagnard')
    mocks.findMany.mockResolvedValue([
      { id: 'perso-2', userId: 'user-2', zoneClimat: null, semaineSemis: 10, semaineRecolte: 30 },
    ])
    mocks.count.mockResolvedValue(1)

    const body = await (await GET(new NextRequest('http://localhost/api/itps?calibre=1'))).json()

    expect(body.data[0]).toMatchObject({
      semaineSemis: 13,
      semaineRecolte: 33,
      decalageClimatiqueApplique: 3,
    })
  })
})
