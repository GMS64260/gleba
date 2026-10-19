/**
 * PATCH /api/elevage/aliments — le stock ne se tient que sur un aliment
 * officiel ou privé du compte (audit 2026-10-19).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  alimentFindFirst: vi.fn(),
  stockUpsert: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    aliment: { findFirst: mocks.alimentFindFirst },
    userStockAliment: { upsert: mocks.stockUpsert },
  },
}))

import { PATCH } from './route'

const patch = (body: object) => PATCH(new NextRequest('http://localhost/api/elevage/aliments', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.stockUpsert.mockResolvedValue({ alimentId: 'foin', stock: 10 })
})

describe('PATCH /api/elevage/aliments', () => {
  it('refuse l’aliment privé d’un autre compte et n’écrit aucun stock', async () => {
    mocks.alimentFindFirst.mockResolvedValue(null)

    const res = await patch({ id: 'aliment-prive-autre', stock: 10 })

    expect(res.status).toBe(404)
    expect((await res.json()).champ).toBe('id')
    expect(mocks.stockUpsert).not.toHaveBeenCalled()
  })

  it('tient le stock d’un aliment accessible comme avant', async () => {
    mocks.alimentFindFirst.mockResolvedValue({ id: 'foin' })

    const res = await patch({ id: 'foin', stock: 10 })

    expect(res.status).toBe(200)
    expect(mocks.stockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_alimentId: { userId: 'user-1', alimentId: 'foin' } },
    }))
  })
})
