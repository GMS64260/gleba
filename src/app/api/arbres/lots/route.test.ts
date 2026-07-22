import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(), parcelleFindFirst: vi.fn(), arbreFindFirst: vi.fn(), lotCreate: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: {
  parcelleGeo: { findFirst: mocks.parcelleFindFirst }, arbre: { findFirst: mocks.arbreFindFirst },
  lotArbres: { create: mocks.lotCreate },
} }))

import { POST } from './route'

const request = (body: unknown) => new Request('http://localhost/api/arbres/lots', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

describe('POST /api/arbres/lots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.arbreFindFirst.mockResolvedValue(null)
    mocks.lotCreate.mockResolvedValue({ id: 1, nom: 'Oliviers', effectif: 20 })
  })

  it('refuse une parcelle étrangère ou non verger avant écriture', async () => {
    mocks.parcelleFindFirst.mockResolvedValue(null)
    const response = await POST(request({ nom: 'Oliviers', espece: 'Olivier', effectif: 20, parcelleGeoId: 'foreign' }) as never)
    expect(response.status).toBe(400)
    expect(mocks.lotCreate).not.toHaveBeenCalled()
  })

  it('crée un seul lot agrégé et aucun arbre individuel', async () => {
    mocks.parcelleFindFirst.mockResolvedValue({ id: 'p1', usage: 'verger', couches: [] })
    const response = await POST(request({ nom: 'Oliviers', espece: 'Olivier', effectif: 20, parcelleGeoId: 'p1' }) as never)
    expect(response.status).toBe(201)
    expect(mocks.lotCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ effectif: 20, userId: 'user-1' }) }))
    expect(mocks.arbreFindFirst).toHaveBeenCalled()
  })
})
