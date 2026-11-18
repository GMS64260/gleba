import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Revue du 2026-11-11 — un plan envoyé avec deux étapes sur la même année
 * ([2, 3, 3] après avoir retiré puis ajouté une année dans la fiche) était
 * enregistré tel quel : le cycle perdait son étape 1 et deux itinéraires se
 * disputaient l'étape 3.
 */
const mocks = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  rotationFindUnique: vi.fn(),
  rotationCreate: vi.fn(),
  transaction: vi.fn(),
  etapesRotationInvalides: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: vi.fn(), requireAdminApi: mocks.requireAdminApi }))
vi.mock('@/lib/rotations/itp-etapes', () => ({
  etapesRotationInvalides: mocks.etapesRotationInvalides,
  messageEtapesInvalides: () => 'étapes invalides',
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    rotation: { findUnique: mocks.rotationFindUnique, create: mocks.rotationCreate },
    $transaction: mocks.transaction,
  },
}))

import { PUT } from './route'
import { POST } from '../route'

const corps = {
  active: false,
  details: [
    { annee: 2, itpId: 'haricot' },
    { annee: 3, itpId: 'phacelie' },
    { annee: 3, itpId: null },
  ],
}
const requete = (methode: 'PUT' | 'POST', url: string, donnees: unknown) =>
  new NextRequest(url, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donnees),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAdminApi.mockResolvedValue({ error: null, session: { user: { id: 'admin-1', role: 'ADMIN' } } })
  mocks.etapesRotationInvalides.mockResolvedValue([])
})

describe('Plan de rotation : une étape par année', () => {
  it('PUT refuse deux étapes sur la même année, sans écrire', async () => {
    mocks.rotationFindUnique.mockResolvedValue({ id: 'Courges', active: false, nbAnnees: 3 })
    const res = await PUT(requete('PUT', 'http://localhost/api/rotations/Courges', corps), {
      params: Promise.resolve({ id: 'Courges' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/année 3 figure plusieurs fois/)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('POST refuse deux étapes sur la même année, sans écrire', async () => {
    mocks.rotationFindUnique.mockResolvedValue(null)
    const res = await POST(requete('POST', 'http://localhost/api/rotations', { id: 'Courges', ...corps }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/année 3 figure plusieurs fois/)
    expect(mocks.rotationCreate).not.toHaveBeenCalled()
  })
})
