import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 2026-10-20 — le dialogue de récolte du calendrier (EventDialog) affichait
 * « kg » en dur. La route sert l'unité de saisie de chaque récolte, surcharge
 * de la ferme comprise, comme `POST /api/recoltes` la figera.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindMany: vi.fn(),
  irrigationFindMany: vi.fn(),
  userStockEspeceFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (session: { user: { id: string } }) => session.user.id,
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    culture: { findMany: mocks.cultureFindMany },
    irrigationPlanifiee: { findMany: mocks.irrigationFindMany },
    userStockEspece: { findMany: mocks.userStockEspeceFindMany },
  },
}))

import { GET } from './route'

const recolte = (id: number, especeId: string, uniteRendement: string | null) => ({
  id,
  especeId,
  varieteId: null,
  dateRecolte: new Date('2026-10-20T10:00:00.000Z'),
  recolteFaite: false,
  espece: { couleur: null, nom: especeId, rendement: 5, uniteRendement },
  variete: null,
  planche: { nom: 'P1', ilot: null },
})

describe('GET /api/calendrier — unité des récoltes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
    mocks.irrigationFindMany.mockResolvedValue([])
    mocks.cultureFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      'dateRecolte' in where
        ? [recolte(1, 'Dahlia', 'kg_m2'), recolte(2, 'Carotte', 'kg_m2'), recolte(3, 'Zinnia', 'tiges_m2')]
        : [],
    )
    // La ferme compte ses dahlias en tiges (carte « Chez moi »).
    mocks.userStockEspeceFindMany.mockResolvedValue([
      { especeId: 'Dahlia', rendement: 40, uniteRendement: 'tiges_m2' },
    ])
  })

  it('sert l’unité effective de chaque récolte, surcharge de la ferme comprise', async () => {
    const res = await GET(
      new NextRequest('http://localhost/api/calendrier?start=2026-10-01T00:00:00.000Z&end=2026-10-31T23:59:59.000Z'),
    )
    expect(res.status).toBe(200)
    const { events } = await res.json()
    const unites = Object.fromEntries(
      events.filter((e: { type: string }) => e.type === 'recolte').map((e: { especeId: string; unite: string }) => [e.especeId, e.unite]),
    )
    expect(unites).toEqual({ Dahlia: 'tige', Carotte: 'kg', Zinnia: 'tige' })
    // Surcharges lues dans le seul compte, pour les espèces récoltées.
    const filtre = mocks.userStockEspeceFindMany.mock.calls[0][0].where
    expect(filtre.userId).toBe('u1')
    expect([...filtre.especeId.in].sort()).toEqual(['Carotte', 'Dahlia', 'Zinnia'])
  })
})
