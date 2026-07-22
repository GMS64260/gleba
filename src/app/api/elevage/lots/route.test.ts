import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  createDepenseFromLotAnimaux: vi.fn(),
  lotFindFirst: vi.fn(),
  lotUpdate: vi.fn(),
  especeFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/auto-compta', () => ({
  createDepenseFromLotAnimaux: mocks.createDepenseFromLotAnimaux,
  deleteAutoEntry: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    lotAnimaux: { findFirst: mocks.lotFindFirst, update: mocks.lotUpdate },
    especeAnimale: { findUnique: mocks.especeFindUnique },
  },
}))

import { PATCH } from './route'

const request = (body: object) => new NextRequest('http://localhost/api/elevage/lots', {
  method: 'PATCH',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

describe('PATCH /api/elevage/lots (édition complète + resync compta)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.lotFindFirst.mockResolvedValue({ id: 5, userId: 'user-1' })
    mocks.lotUpdate.mockResolvedValue({ id: 5, nom: 'Poules', prixAchatTotal: 0, dateArrivee: null })
  })

  it('applique prixAchatTotal (0 compris) et resynchronise la dépense d’achat', async () => {
    const res = await PATCH(request({ id: 5, prixAchatTotal: 0, nom: 'Poules' }))

    expect(res.status).toBe(200)
    expect(mocks.lotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prixAchatTotal: 0, nom: 'Poules' }) })
    )
    expect(mocks.createDepenseFromLotAnimaux).toHaveBeenCalledTimes(1)
  })

  it('rejette une date d’arrivée hors bornes (faute d’année type 0204)', async () => {
    const res = await PATCH(request({ id: 5, dateArrivee: '0204-06-03' }))

    expect(res.status).toBe(400)
    expect(mocks.lotUpdate).not.toHaveBeenCalled()
  })
})
