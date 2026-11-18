import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(), parcelleFindFirst: vi.fn(), arbreFindFirst: vi.fn(),
  lotFindFirst: vi.fn(), lotCreate: vi.fn(), lotUpdate: vi.fn(), lotDelete: vi.fn(),
  verrou: vi.fn(), transaction: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/stocks/verrou-commercial', () => ({ verrouillerStockCommercial: mocks.verrou }))
vi.mock('@/lib/prisma', () => ({ default: { $transaction: mocks.transaction } }))

import { POST, PATCH, DELETE } from './route'
import { NextRequest } from 'next/server'

const tx = {
  parcelleGeo: { findFirst: mocks.parcelleFindFirst }, arbre: { findFirst: mocks.arbreFindFirst },
  lotArbres: { findFirst: mocks.lotFindFirst, create: mocks.lotCreate, update: mocks.lotUpdate, delete: mocks.lotDelete },
}
const request = (body: unknown, method = 'POST') => new NextRequest('http://localhost/api/arbres/lots?id=1', {
  method, headers: { 'content-type': 'application/json' }, ...(method === 'DELETE' ? {} : { body: JSON.stringify(body) }),
})
const lot = { id: 1, nom: 'Oliviers', espece: 'Olivier', effectif: 20, parcelleGeoId: 'p1' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.transaction.mockImplementation(async (callback) => callback(tx))
  mocks.verrou.mockResolvedValue(undefined)
  mocks.parcelleFindFirst.mockResolvedValue({ id: 'p1', usage: 'verger', couches: [] })
  mocks.arbreFindFirst.mockResolvedValue(null)
  mocks.lotFindFirst.mockResolvedValue(lot)
  mocks.lotCreate.mockResolvedValue(lot)
  mocks.lotUpdate.mockResolvedValue(lot)
})

describe('mutations /api/arbres/lots sous le verrou partagé du suivi', () => {
  it('refuse une parcelle étrangère ou non verger avant écriture', async () => {
    mocks.parcelleFindFirst.mockResolvedValue(null)
    const response = await POST(request({ ...lot, parcelleGeoId: 'foreign' }))
    expect(response.status).toBe(400)
    expect(mocks.lotCreate).not.toHaveBeenCalled()
  })

  it('crée un seul lot agrégé et aucun arbre individuel', async () => {
    const response = await POST(request(lot))
    expect(response.status).toBe(201)
    expect(mocks.lotCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ effectif: 20, userId: 'user-1' }) }))
    expect(mocks.arbreFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1', parcelleGeoId: 'p1' }) }))
    expect(mocks.verrou).toHaveBeenCalledWith(tx, 'user-1')
    expect(mocks.verrou.mock.invocationCallOrder[0]).toBeLessThan(mocks.arbreFindFirst.mock.invocationCallOrder[0])
  })

  it.each(['POST', 'PATCH'])('%s refuse un conflit individuel relu sous verrou', async (method) => {
    mocks.arbreFindFirst.mockResolvedValue({ id: 4 })
    const response = await (method === 'POST' ? POST : PATCH)(request(lot, method))
    expect(response.status).toBe(409)
    expect(mocks.lotCreate).not.toHaveBeenCalled()
    expect(mocks.lotUpdate).not.toHaveBeenCalled()
    expect(mocks.verrou.mock.invocationCallOrder[0]).toBeLessThan(mocks.arbreFindFirst.mock.invocationCallOrder[0])
  })

  it('PATCH relit aussi les champs conservés après acquisition du verrou', async () => {
    mocks.lotFindFirst.mockResolvedValue({ ...lot, effectif: 32, espece: 'Pommier' })
    const response = await PATCH(request({ id: 1, notes: 'Observation corrigée' }, 'PATCH'))
    expect(response.status).toBe(200)
    expect(mocks.verrou.mock.invocationCallOrder[0]).toBeLessThan(mocks.lotFindFirst.mock.invocationCallOrder[0])
    expect(mocks.lotUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1, userId: 'user-1' }, data: expect.objectContaining({ effectif: 32, espece: 'Pommier', notes: 'Observation corrigée' }),
    }))
  })

  it.each(['PATCH', 'DELETE'])('%s refuse un lot absent du tenant', async (method) => {
    mocks.lotFindFirst.mockResolvedValue(null)
    const response = await (method === 'PATCH' ? PATCH : DELETE)(request(lot, method))
    expect(response.status).toBe(404)
    expect(mocks.lotFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, userId: 'user-1' } }))
    expect(mocks.lotUpdate).not.toHaveBeenCalled()
    expect(mocks.lotDelete).not.toHaveBeenCalled()
  })

  it('DELETE prend le même verrou avant de relire et supprimer le lot du tenant', async () => {
    const response = await DELETE(request(null, 'DELETE'))
    expect(response.status).toBe(200)
    expect(mocks.verrou).toHaveBeenCalledWith(tx, 'user-1')
    expect(mocks.verrou.mock.invocationCallOrder[0]).toBeLessThan(mocks.lotFindFirst.mock.invocationCallOrder[0])
    expect(mocks.lotDelete).toHaveBeenCalledWith({ where: { id: 1, userId: 'user-1' } })
  })
})
