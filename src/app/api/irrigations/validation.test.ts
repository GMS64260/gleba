/**
 * Revue du 2026-11-11 : identifiant, culture ou date illisibles partaient
 * tels quels vers Prisma (NaN, Invalid Date) et la route rendait 500. Elle
 * les refuse désormais avant toute lecture.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  irrigation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  culture: { findFirst: vi.fn() },
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (session: { user: { id: string } }) => session.user.id,
}))
vi.mock('@/lib/prisma', () => ({ default: { irrigationPlanifiee: mocks.irrigation, culture: mocks.culture } }))
vi.mock('@/lib/irrigation-recording', () => ({ enregistrerArrosageCultures: vi.fn() }))

import { GET as LISTE, POST } from './route'
import { DELETE, GET, PATCH } from './[id]/route'

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

const aucuneLecture = () => {
  for (const f of [...Object.values(mocks.irrigation), ...Object.values(mocks.culture)]) expect(f).not.toHaveBeenCalled()
}

const existante = {
  id: 5, userId: 'u1', cultureId: 12, datePrevue: new Date('2026-10-21T00:00:00.000Z'),
  dateEffective: null, fait: false, perimee: false, notes: null, culture: { plancheId: null },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  mocks.irrigation.findMany.mockResolvedValue([])
  mocks.irrigation.findFirst.mockResolvedValue(existante)
  mocks.irrigation.findUniqueOrThrow.mockResolvedValue({ ...existante, culture: { id: 12, espece: null } })
  mocks.culture.findFirst.mockResolvedValue({ id: 12, userId: 'u1' })
})

describe('GET /api/irrigations : filtres', () => {
  it.each([
    ['cultureId=abc'],
    ['cultureId=12abc'],
    ['cultureId=-3'],
    ['start=hier&end=2026-10-31'],
    ['start=2026-10-01&end=demain'],
  ])('%s : 400, sans lecture', async (filtre) => {
    const res = await LISTE(requete('GET', `/api/irrigations?${filtre}`))
    expect(res.status).toBe(400)
    aucuneLecture()
  })

  it('filtres lisibles : bornés au compte', async () => {
    const res = await LISTE(requete('GET', '/api/irrigations?cultureId=12&start=2026-10-01&end=2026-10-31&fait=true'))
    expect(res.status).toBe(200)
    expect(mocks.irrigation.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
      cultureId: 12,
      datePrevue: { gte: new Date('2026-10-01'), lte: new Date('2026-10-31') },
      fait: true,
    })
  })
})

describe('POST /api/irrigations', () => {
  it.each([
    ['corps illisible', '{pas du json'],
    ['corps qui n’est pas un objet', '[]'],
    ['culture non entière', { cultureId: 'douze', datePrevue: '2026-10-21' }],
    ['culture décimale', { cultureId: 1.5, datePrevue: '2026-10-21' }],
    ['date illisible', { cultureId: 12, datePrevue: 'bientôt' }],
    ['date absente', { cultureId: 12 }],
    ['notes non textuelles', { cultureId: 12, datePrevue: '2026-10-21', notes: { a: 1 } }],
  ])('%s : 400, sans lecture', async (_cas, corps) => {
    const res = await POST(requete('POST', '/api/irrigations', corps))
    expect(res.status).toBe(400)
    aucuneLecture()
  })

  it('entrée lisible : créée pour le compte', async () => {
    mocks.irrigation.create.mockResolvedValue({ ...existante, culture: { id: 12, espece: null } })
    const res = await POST(requete('POST', '/api/irrigations', { cultureId: 12, datePrevue: '2026-10-21', notes: 'matin' }))
    expect(res.status).toBe(201)
    expect(mocks.culture.findFirst.mock.calls[0][0].where).toEqual({ id: 12, userId: 'u1' })
    expect(mocks.irrigation.create.mock.calls[0][0].data).toEqual({
      userId: 'u1', cultureId: 12, datePrevue: new Date('2026-10-21'), notes: 'matin',
    })
  })
})

describe('/api/irrigations/[id]', () => {
  it.each([['abc'], ['5abc'], ['0'], ['-2'], ['1.5']])('identifiant « %s » : 400 sur les trois verbes', async (id) => {
    expect((await GET(requete('GET', `/api/irrigations/${id}`), params(id))).status).toBe(400)
    expect((await PATCH(requete('PATCH', `/api/irrigations/${id}`, { fait: true }), params(id))).status).toBe(400)
    expect((await DELETE(requete('DELETE', `/api/irrigations/${id}`), params(id))).status).toBe(400)
    aucuneLecture()
  })

  it.each([
    ['corps illisible', '{pas du json'],
    ['date effective illisible', { dateEffective: 'hier soir' }],
    ['date prévue illisible', { datePrevue: 'bientôt' }],
    ['date prévue vidée', { datePrevue: null }],
    ['notes non textuelles', { notes: 12 }],
  ])('PATCH %s : 400, rien n’est écrit', async (_cas, corps) => {
    const res = await PATCH(requete('PATCH', '/api/irrigations/5', corps), params('5'))
    expect(res.status).toBe(400)
    expect(mocks.irrigation.updateMany).not.toHaveBeenCalled()
  })

  it('PATCH lisible : dates converties, date effective effaçable', async () => {
    const res = await PATCH(
      requete('PATCH', '/api/irrigations/5', { datePrevue: '2026-10-22', dateEffective: null, notes: null }),
      params('5'),
    )
    expect(res.status).toBe(200)
    expect(mocks.irrigation.updateMany.mock.calls[0][0]).toEqual({
      where: { userId: 'u1', id: { in: [5] } },
      data: { datePrevue: new Date('2026-10-22'), dateEffective: null, notes: null },
    })
  })
})
