import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { $transaction: mocks.transaction } }))

import { creerRecolteFruit } from '../creation-recolte'

const SUITE = new Error('garde franchie')
const saisie = { arbreId: 1, quantite: 5, date: '2026-10-10' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transaction.mockRejectedValue(SUITE)
})

describe('création d’une récolte de fruits : péremption', () => {
  it('refuse une péremption antérieure à la récolte, avant toute écriture', async () => {
    await expect(creerRecolteFruit('u1', { ...saisie, datePeremption: '2026-10-09' })).rejects.toMatchObject({
      status: 400, champ: 'datePeremption', message: expect.stringContaining('La péremption (09/10/2026) précède la récolte (10/10/2026)'),
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('accepte une péremption le jour même ou absente', async () => {
    await expect(creerRecolteFruit('u1', { ...saisie, datePeremption: '2026-10-10' })).rejects.toBe(SUITE)
    await expect(creerRecolteFruit('u1', saisie)).rejects.toBe(SUITE)
  })
})
