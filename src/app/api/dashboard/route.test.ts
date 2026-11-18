import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { clearKpiCache } from '@/lib/kpi/cache'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  recolteCount: vi.fn(),
  recolteGroupBy: vi.fn(),
  recolteFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
// Garder les vrais calculs maraîchers sans charger le domaine comptable.
vi.mock('@/lib/kpi/compta', () => ({ getKpiCompta: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    espece: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    arbre: { count: vi.fn().mockResolvedValue(0) },
    culture: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    planche: { findMany: vi.fn().mockResolvedValue([]) },
    recolte: {
      count: mocks.recolteCount,
      groupBy: mocks.recolteGroupBy,
      findMany: mocks.recolteFindMany,
    },
  },
}))

import { GET } from './route'

const maintenant = new Date(2026, 5, 15, 12)
const recoltes = [
  { userId: 'ferme-test', date: new Date(2024, 11, 31), quantite: 100 },
  { userId: 'ferme-test', date: new Date(2025, 0, 1), quantite: 5 },
  { userId: 'ferme-test', date: new Date(2025, 11, 31, 23, 59, 59, 999), quantite: 7 },
  { userId: 'ferme-test', date: new Date(2026, 0, 1), quantite: 11 },
  { userId: 'ferme-test', date: maintenant, quantite: 13 },
  { userId: 'ferme-test', date: new Date(maintenant.getTime() + 1), quantite: 17 },
  { userId: 'ferme-test', date: new Date(2027, 0, 1), quantite: 19 },
  { userId: 'autre-ferme', date: new Date(2025, 5, 1), quantite: 1000 },
  { userId: 'autre-ferme', date: new Date(2026, 5, 1), quantite: 1000 },
].map((r) => ({ ...r, unite: 'kg', especeId: 'carotte', espece: null }))

type FiltreRecoltes = { userId: string; date: { gte: Date; lte: Date } }

function selectionner(where: FiltreRecoltes) {
  return recoltes.filter((r) =>
    r.userId === where.userId && r.date >= where.date.gte && r.date <= where.date.lte,
  )
}

describe('GET /api/dashboard — récoltes à date dans l’année sélectionnée', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(maintenant)
    vi.clearAllMocks()
    clearKpiCache()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: 'ferme-test' } }, error: null })
    mocks.recolteCount.mockImplementation(async ({ where }: { where: FiltreRecoltes }) =>
      selectionner(where).length,
    )
    mocks.recolteGroupBy.mockImplementation(async ({ where }: { where: FiltreRecoltes }) =>
      selectionner(where).map((r) => ({ ...r, _sum: { quantite: r.quantite } })),
    )
    mocks.recolteFindMany.mockImplementation(async ({ where }: {
      where: FiltreRecoltes & { culture?: unknown }
    }) => where.culture ? [] : selectionner(where))
  })

  afterEach(() => {
    vi.useRealTimers()
    clearKpiCache()
  })

  it('compte seulement 2025, du 1er janvier au dernier instant du 31 décembre', async () => {
    const response = await GET(new NextRequest('http://localhost/api/dashboard?year=2025'))
    expect(response.status).toBe(200)
    const { stats } = await response.json()

    expect(stats.recoltesCount).toBe(2)
    expect(stats.recoltesAnnee).toBe(12)
  })

  it.each(['?year=2026', ''])('garde l’année courante arrêtée à maintenant (%s)', async (query) => {
    const response = await GET(new NextRequest(`http://localhost/api/dashboard${query}`))
    expect(response.status).toBe(200)
    const { stats } = await response.json()

    expect(stats.recoltesCount).toBe(2)
    expect(stats.recoltesAnnee).toBe(24)
  })

  it('ne compte aucune récolte à venir pour une année future', async () => {
    const response = await GET(new NextRequest('http://localhost/api/dashboard?year=2027'))
    expect(response.status).toBe(200)
    const { stats } = await response.json()

    expect(stats.recoltesCount).toBe(0)
    expect(stats.recoltesAnnee).toBe(0)
  })
})
