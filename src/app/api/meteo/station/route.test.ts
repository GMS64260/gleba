/** `POST /api/meteo/station` : entrées mal typées refusées en 400, jamais de 500 ni de NaN rangé. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ create: vi.fn(), updateMany: vi.fn(), ecowitt: vi.fn(), wu: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = { stationMeteo: { create: m.create, updateMany: m.updateMany } }
  return { default: { ...tx, $transaction: (f: (t: typeof tx) => unknown) => f(tx) } }
})
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'ferme-synthetique' } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock('@/lib/meteo', () => ({ fetchEcowittData: m.ecowitt, fetchWundergroundData: m.wu }))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
import { POST } from './route'

const poster = (corps: unknown) =>
  POST(new NextRequest('http://localhost/api/meteo/station', { method: 'POST', body: JSON.stringify(corps) }))
const valide = { nom: 'Station du hangar', provider: 'wunderground', stationId: 'ISYNTH1', apiKey: 'cle-synthetique' }

beforeEach(() => {
  vi.clearAllMocks()
  m.wu.mockResolvedValue({ temperature: 12 })
  m.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 's1', ...data }))
})

describe('POST /api/meteo/station', () => {
  it.each([
    ['nom non textuel', { ...valide, nom: { a: 1 } }],
    ['identifiant non textuel', { ...valide, stationId: 42 }],
    ['clé non textuelle', { ...valide, apiKey: ['x'] }],
    ['latitude illisible', { ...valide, lat: '43.6abc', lng: 1.4 }],
    ['latitude hors bornes', { ...valide, lat: 999, lng: 1.4 }],
    ['corps qui n’est pas un objet', null],
  ])('refuse en 400 : %s', async (_cas, corps) => {
    const res = await poster(corps)
    expect(res.status).toBe(400)
    expect(m.wu).not.toHaveBeenCalled()
    expect(m.create).not.toHaveBeenCalled()
  })

  it('range des coordonnées numériques, y compris 0, et null si absentes', async () => {
    await poster({ ...valide, lat: '0', lng: '-1.5' })
    expect(m.create.mock.calls[0][0].data).toMatchObject({ lat: 0, lng: -1.5, nom: 'Station du hangar' })
    await poster(valide)
    expect(m.create.mock.calls[1][0].data).toMatchObject({ lat: null, lng: null })
  })
})
