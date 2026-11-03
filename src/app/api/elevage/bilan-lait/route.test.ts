import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ auth: vi.fn(), bilans: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: m.auth }))
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/elevage/bilan-lait', async (original) => ({
  ...(await original<typeof import('@/lib/elevage/bilan-lait')>()),
  chargerBilansLait: m.bilans,
}))

import { GET } from './route'

const lire = (query = '') => GET(new NextRequest(`http://localhost/api/elevage/bilan-lait${query}`))

describe('GET /api/elevage/bilan-lait', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.auth.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
    m.bilans.mockResolvedValue({ jours7: {}, mois: {} })
  })

  it('lit le jour demandé pour le compte connecté', async () => {
    expect((await lire('?date=2026-11-03')).status).toBe(200)
    expect(m.bilans).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-11-03')
  })

  it('prend le jour civil de Paris par défaut', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T23:30:00Z'))
    try {
      await lire()
      expect(m.bilans).toHaveBeenCalledWith(expect.anything(), 'u1', '2026-11-03')
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['2026-02-31', '03/11/2026', 'demain'])('refuse la date %s', async (date) => {
    expect((await lire(`?date=${encodeURIComponent(date)}`)).status).toBe(400)
    expect(m.bilans).not.toHaveBeenCalled()
  })

  it('exige une session', async () => {
    m.auth.mockResolvedValue({ error: new Response(null, { status: 401 }), session: null })
    expect((await lire()).status).toBe(401)
  })
})
