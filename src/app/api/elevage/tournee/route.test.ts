import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(), operationFindFirst: vi.fn(), taskFindFirst: vi.fn(),
  realisationCreate: vi.fn(), taskUpdate: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: {
  realisationTacheElevage: { findFirst: mocks.operationFindFirst },
  tacheTerrainElevage: { findFirst: mocks.taskFindFirst },
  $transaction: (callback: (tx: unknown) => unknown) => callback({
    realisationTacheElevage: { create: mocks.realisationCreate },
    tacheTerrainElevage: { update: mocks.taskUpdate },
  }),
} }))
import { POST } from './route'

const due = new Date('2026-07-20T08:00:00Z')
const request = () => new NextRequest('http://localhost/api/elevage/tournee', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tacheId: 't1', dateEcheance: due, clientOperationId: '5d8b72e1-45eb-4f3b-a4b9-bb710ea83f3e' }) })

describe('acquittement tournée', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
    mocks.operationFindFirst.mockResolvedValue(null)
    mocks.taskFindFirst.mockResolvedValue({ id: 't1', userId: 'u1', prochaineEcheance: due, recurrenceJours: 7 })
    mocks.realisationCreate.mockResolvedValue({ id: 'r1' })
  })

  it('est idempotent sur clientOperationId', async () => {
    mocks.operationFindFirst.mockResolvedValue({ id: 'r-existing' })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect((await res.json()).duplicate).toBe(true)
    expect(mocks.realisationCreate).not.toHaveBeenCalled()
  })

  it('refuse une occurrence déjà avancée', async () => {
    mocks.taskFindFirst.mockResolvedValue({ id: 't1', prochaineEcheance: new Date('2026-07-21T08:00:00Z'), recurrenceJours: 7 })
    const res = await POST(request())
    expect(res.status).toBe(409)
    expect(mocks.realisationCreate).not.toHaveBeenCalled()
  })

  it('enregistre et avance une tâche récurrente', async () => {
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(mocks.realisationCreate).toHaveBeenCalledOnce()
    expect(mocks.taskUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1' }, data: { prochaineEcheance: expect.any(Date) } }))
  })
})
