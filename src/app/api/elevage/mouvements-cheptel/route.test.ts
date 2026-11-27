import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindFirst: vi.fn(),
  animalFindFirst: vi.fn(),
  parcelleFindFirst: vi.fn(),
  mouvementCreate: vi.fn(),
  mouvementFindFirst: vi.fn(),
  lotUpdateMany: vi.fn(),
  animalUpdateMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    mouvementCheptel: { create: mocks.mouvementCreate, findFirst: mocks.mouvementFindFirst },
    lotAnimaux: { findFirst: mocks.lotFindFirst, updateMany: mocks.lotUpdateMany },
    animal: { findFirst: mocks.animalFindFirst, updateMany: mocks.animalUpdateMany },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst },
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
    // Le mouvement saisi est le plus récent : la position suit sa destination.
    mocks.mouvementFindFirst.mockResolvedValue({ parcelleApresId: 'parcelle-2', date: new Date('2026-07-22T10:00:00.000Z') })
    mocks.lotUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('refuse (409) un déplacement dont l’origine annoncée n’est plus la position réelle (D223)', async () => {
    // Le lot a été déplacé depuis un autre onglet : il est en parcelle-9, le formulaire annonce « aucune parcelle ».
    mocks.lotFindFirst.mockResolvedValue({ id: 12, parcelleGeoId: 'parcelle-9' })

    const response = await POST(request({ lotId: 12, parcelleAvantId: null, parcelleApresId: null, date: '2026-07-22T10:00:00.000Z' }))

    expect(response.status).toBe(409)
    expect((await response.json()).error).toMatch(/position a changé/)
    expect(mocks.mouvementCreate).not.toHaveBeenCalled()
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
