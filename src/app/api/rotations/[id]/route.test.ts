import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 2026-10-20 — la liste et la fiche des rotations refusaient seules la
 * suppression d'après les planches DU COMPTE (« utilisee par 2 planche(s) »),
 * et remplaçaient le refus du serveur par « Impossible de supprimer la
 * rotation ». La rotation étant un référentiel global, un administrateur sans
 * planche passait la garde de l'écran et n'apprenait jamais pourquoi la route
 * refusait. La route porte la règle et un message qui nomme ce qui bloque.
 */

const mocks = vi.hoisted(() => ({
  requireAdminApi: vi.fn(),
  rotationFindUnique: vi.fn(),
  rotationDelete: vi.fn(),
  plancheFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: vi.fn(),
  requireAdminApi: mocks.requireAdminApi,
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    rotation: { findUnique: mocks.rotationFindUnique, delete: mocks.rotationDelete },
    planche: { findMany: mocks.plancheFindMany },
  },
}))

import { DELETE } from './route'

const supprimer = (id = 'Rotation courte') =>
  DELETE(
    new NextRequest(`http://localhost/api/rotations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) },
  )

describe('DELETE /api/rotations/[id] — refus porté par la route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdminApi.mockResolvedValue({ error: null, session: { user: { id: 'admin-1', role: 'ADMIN' } } })
    mocks.plancheFindMany.mockResolvedValue([])
    mocks.rotationDelete.mockResolvedValue({})
  })

  it('nomme les planches du compte et compte celles des autres comptes (409)', async () => {
    mocks.rotationFindUnique.mockResolvedValue({ id: 'Rotation courte', _count: { planches: 5 } })
    mocks.plancheFindMany.mockResolvedValue([{ nom: 'P1' }, { nom: 'P2' }])

    const res = await supprimer()
    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps.error).toBe(
      'Impossible de supprimer la rotation « Rotation courte » : elle est suivie par 2 de vos planches ' +
        "(« P1 » et « P2 ») et par 3 planches d'autres comptes. Retirez-la d’abord de ces planches, depuis leur fiche.",
    )
    expect(corps.details).toEqual({ planches: 5, planchesDuCompte: 2, planchesAutresComptes: 3 })
    // Noms lus dans le seul compte de l'administrateur.
    expect(mocks.plancheFindMany.mock.calls[0][0].where).toEqual({ rotationId: 'Rotation courte', userId: 'admin-1' })
    expect(mocks.rotationDelete).not.toHaveBeenCalled()
  })

  it('refuse aussi quand seules des planches d’autres comptes la suivent (écran à 0 planche)', async () => {
    mocks.rotationFindUnique.mockResolvedValue({ id: 'Rotation courte', _count: { planches: 1 } })
    const res = await supprimer()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(
      "Impossible de supprimer la rotation « Rotation courte » : elle est suivie par 1 planche d'autres comptes.",
    )
    expect(mocks.rotationDelete).not.toHaveBeenCalled()
  })

  it('supprime une rotation qu’aucune planche ne suit', async () => {
    mocks.rotationFindUnique.mockResolvedValue({ id: 'Rotation courte', _count: { planches: 0 } })
    const res = await supprimer()
    expect(res.status).toBe(200)
    expect(mocks.rotationDelete).toHaveBeenCalledWith({ where: { id: 'Rotation courte' } })
    expect(mocks.plancheFindMany).not.toHaveBeenCalled()
  })

  it('404 accentué pour une rotation inconnue', async () => {
    mocks.rotationFindUnique.mockResolvedValue(null)
    const res = await supprimer('Inconnue')
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('Rotation « Inconnue » introuvable')
  })
})
