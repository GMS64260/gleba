import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindFirst: vi.fn(),
  animalFindFirst: vi.fn(),
  parcelleFindFirst: vi.fn(),
  mouvementCreate: vi.fn(),
  lotUpdateMany: vi.fn(),
  animalUpdateMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    mouvementCheptel: { create: mocks.mouvementCreate },
    lotAnimaux: { updateMany: mocks.lotUpdateMany },
    animal: { updateMany: mocks.animalUpdateMany },
  }
  return { default: {
    animal: { findFirst: mocks.animalFindFirst },
    lotAnimaux: { findFirst: mocks.lotFindFirst },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst },
    $transaction: mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } }
})

import { POST } from './route'

const request = (body: object) => new NextRequest('http://localhost/api/elevage/mouvements-cheptel', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

describe('POST mouvements-cheptel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.lotFindFirst.mockResolvedValue({ id: 12 })
    mocks.animalFindFirst.mockResolvedValue({ id: 7 })
    mocks.parcelleFindFirst.mockResolvedValue({ id: 'parcelle-1' })
    mocks.mouvementCreate.mockResolvedValue({ id: 'mouvement-1' })
    mocks.lotUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('journalise et met a jour le lot dans la meme transaction', async () => {
    const response = await POST(request({
      lotId: 12,
      parcelleAvantId: 'parcelle-1',
      parcelleApresId: 'parcelle-2',
      date: '2026-07-22T10:00:00.000Z',
    }))

    expect(response.status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.mouvementCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: 'user-1', lotId: 12, parcelleAvantId: 'parcelle-1', parcelleApresId: 'parcelle-2',
    }) })
    expect(mocks.lotUpdateMany).toHaveBeenCalledWith({
      where: { id: 12, userId: 'user-1' },
      data: { parcelleGeoId: 'parcelle-2' },
    })
  })

  it('met aussi a jour un animal individuel dans la transaction', async () => {
    const response = await POST(request({
      animalId: 7,
      parcelleAvantId: 'parcelle-1',
      parcelleApresId: 'parcelle-2',
      date: '2026-07-22T10:00:00.000Z',
    }))

    expect(response.status).toBe(201)
    expect(mocks.animalUpdateMany).toHaveBeenCalledWith({
      where: { id: 7, userId: 'user-1' },
      data: { parcelleGeoId: 'parcelle-2' },
    })
    expect(mocks.lotUpdateMany).not.toHaveBeenCalled()
  })
})
