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
  // Une récolte de 5 kg scindée par une sortie partielle : deux lignes, une récolte.
  { userId: 'ferme-test', date: new Date(2025, 0, 1), quantite: 3 },
  { userId: 'ferme-test', date: new Date(2025, 0, 1), quantite: 2, recolteOrigineId: 2 },
  { userId: 'ferme-test', date: new Date(2025, 11, 31, 23, 59, 59, 999), quantite: 7 },
  { userId: 'ferme-test', date: new Date(2026, 0, 1), quantite: 11 },
  { userId: 'ferme-test', date: maintenant, quantite: 13 },
  // Demain : hors du cumul. La borne est le soir d'aujourd'hui, pas l'instant
  // présent : une récolte datée du jour (minuit UTC, soit 1 h ou 2 h à Paris)
  // restait hors du cumul jusqu'à cette heure (équipe debug, D70).
  { userId: 'ferme-test', date: new Date(2026, 5, 16), quantite: 17 },
  { userId: 'ferme-test', date: new Date(2027, 0, 1), quantite: 19 },
  { userId: 'autre-ferme', date: new Date(2025, 5, 1), quantite: 1000 },
  { userId: 'autre-ferme', date: new Date(2026, 5, 1), quantite: 1000 },
].map((r, rang) => ({ id: rang + 1, recolteOrigineId: null, ...r, unite: 'kg', especeId: 'carotte', espece: null }))

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

  it.each(['?year=2026', ''])('garde l’année courante arrêtée au soir d’aujourd’hui (%s)', async (query) => {
    const response = await GET(new NextRequest(`http://localhost/api/dashboard${query}`))
    expect(response.status).toBe(200)
    const { stats } = await response.json()

    expect(stats.recoltesCount).toBe(2)
    expect(stats.recoltesAnnee).toBe(24)
  })

  // D70 — juste après minuit à Paris, une récolte datée du jour (stockée à
  // minuit UTC, soit plus tard que « maintenant ») est déjà dans le cumul.
  it('compte une récolte datée du jour dès minuit passé', async () => {
    vi.setSystemTime(new Date(2026, 5, 15, 0, 30))
    recoltes.push({ id: 99, recolteOrigineId: null, userId: 'ferme-test', date: new Date('2026-06-15T00:00:00.000Z'), quantite: 5, unite: 'kg', especeId: 'carotte', espece: null })
    try {
      const response = await GET(new NextRequest('http://localhost/api/dashboard?year=2026'))
      const { stats } = await response.json()
      // La récolte de midi du jour (13 kg) compte aussi : la borne est le soir.
      expect(stats.recoltesAnnee).toBe(29)
    } finally {
      recoltes.pop()
    }
  })

  it('ne compte aucune récolte à venir pour une année future', async () => {
    const response = await GET(new NextRequest('http://localhost/api/dashboard?year=2027'))
    expect(response.status).toBe(200)
    const { stats } = await response.json()

    expect(stats.recoltesCount).toBe(0)
    expect(stats.recoltesAnnee).toBe(0)
  })
})
