/**
 * PATCH /api/elevage/saillies — la campagne de lutte se revalide comme au POST.
 *
 * Audit 2026-10-19 : le POST vérifiait que `campagneId` appartient au compte,
 * le PATCH l'écrivait tel quel et rattachait la saillie à la campagne d'un
 * autre compte (dont les statistiques de réussite étaient alors faussées).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  saillieFindFirst: vi.fn(),
  saillieUpdate: vi.fn(),
  campagneFindFirst: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/reproduction', () => ({
  dateMiseBasAttendue: vi.fn(),
  dateTarissementPrevue: vi.fn(),
  detecterConsanguinite: vi.fn(),
  dureeGestationEspece: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    saillie: { findFirst: mocks.saillieFindFirst, update: mocks.saillieUpdate },
    campagneReproduction: { findFirst: mocks.campagneFindFirst },
  },
}))

import { PATCH } from './route'

const patch = (body: object) => PATCH(new NextRequest('http://localhost/api/elevage/saillies', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.saillieFindFirst.mockResolvedValue({
    id: 's1',
    statut: 'En attente',
    miseBas: null,
    femelle: { especeAnimale: { id: 'chevre' } },
  })
  mocks.saillieUpdate.mockImplementation(async ({ data }: { data: object }) => ({ id: 's1', ...data }))
})

describe('PATCH /api/elevage/saillies — campagneId', () => {
  it('refuse la campagne d’un autre compte, nomme le champ et n’écrit rien', async () => {
    mocks.campagneFindFirst.mockResolvedValue(null)

    const res = await patch({ id: 's1', campagneId: 'campagne-autre-compte' })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Campagne introuvable', champ: 'campagneId' })
    expect(mocks.campagneFindFirst).toHaveBeenCalledWith({
      where: { id: 'campagne-autre-compte', userId: 'user-1' },
      select: { id: true },
    })
    expect(mocks.saillieUpdate).not.toHaveBeenCalled()
  })

  it('rattache à une campagne du compte', async () => {
    mocks.campagneFindFirst.mockResolvedValue({ id: 'campagne-1' })

    const res = await patch({ id: 's1', campagneId: 'campagne-1' })

    expect(res.status).toBe(200)
    expect(mocks.saillieUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ campagneId: 'campagne-1' }),
    }))
  })

  it('détacher la campagne (null) ne demande aucune vérification', async () => {
    const res = await patch({ id: 's1', campagneId: null })

    expect(res.status).toBe(200)
    expect(mocks.campagneFindFirst).not.toHaveBeenCalled()
  })
})
