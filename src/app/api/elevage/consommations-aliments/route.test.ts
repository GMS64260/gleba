/**
 * Consommations d'aliment — l'aliment doit être officiel ou privé du compte.
 *
 * Audit 2026-10-19 : POST et PATCH écrivaient l'`alimentId` reçu sans contrôle.
 * On pouvait viser l'aliment privé d'un autre compte : son nom revenait dans la
 * réponse, et son auteur ne pouvait plus le supprimer (`onDelete: Restrict`).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  alimentFindFirst: vi.fn(),
  consoFindFirst: vi.fn(),
  stockFindUnique: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/auto-compta', () => ({
  createDepenseFromConsommationAliment: vi.fn(),
  deleteAutoEntry: vi.fn(),
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    aliment: { findFirst: mocks.alimentFindFirst },
    consommationAliment: { findFirst: mocks.consoFindFirst },
    userStockAliment: { findUnique: mocks.stockFindUnique },
    $transaction: mocks.transaction,
  },
}))

import { PATCH, POST } from './route'

const requete = (method: 'POST' | 'PATCH', body: object) =>
  new NextRequest('http://localhost/api/elevage/consommations-aliments', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.consoFindFirst.mockResolvedValue({ id: 3, userId: 'user-1', alimentId: 'foin', quantite: 5 })
})

describe('consommations d’aliment — alimentId', () => {
  it('POST refuse l’aliment privé d’un autre compte avant toute écriture', async () => {
    mocks.alimentFindFirst.mockResolvedValue(null)

    const res = await POST(requete('POST', { alimentId: 'aliment-prive-autre', quantite: 2 }))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Aliment introuvable ou inaccessible pour ce compte',
      champ: 'alimentId',
    })
    expect(mocks.alimentFindFirst).toHaveBeenCalledWith({
      where: { id: 'aliment-prive-autre', OR: [{ ownerUserId: null }, { ownerUserId: 'user-1' }] },
      select: { id: true },
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('PATCH refuse de basculer sur l’aliment privé d’un autre compte', async () => {
    mocks.alimentFindFirst.mockResolvedValue(null)

    const res = await PATCH(requete('PATCH', { id: 3, alimentId: 'aliment-prive-autre', quantite: 5 }))

    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe('alimentId')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('PATCH sans changement d’aliment ne le revérifie pas', async () => {
    mocks.transaction.mockResolvedValue({ id: 3, alimentId: 'foin', quantite: 6 })

    const res = await PATCH(requete('PATCH', { id: 3, alimentId: 'foin', quantite: 6 }))

    expect(mocks.alimentFindFirst).not.toHaveBeenCalled()
    expect(mocks.transaction).toHaveBeenCalled()
    expect(res.status).not.toBe(400)
  })
})
