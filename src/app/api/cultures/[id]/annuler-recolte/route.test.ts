/**
 * POST /api/cultures/[id]/annuler-recolte — revue du 2026-11-04.
 *
 * La page Tâches supprimait les lots en stock AVANT de se voir refuser
 * l'annulation : les lots disparaissaient sous un « Annulation refusée ».
 * La route décide tout avant d'écrire.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  cultureFindFirst: vi.fn(),
  cultureUpdate: vi.fn(),
  recolteFindMany: vi.fn(),
  recolteDelete: vi.fn(),
  verrou: vi.fn(),
  deleteAutoEntry: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/exploitation/garde-session', () => ({ refusSiLectureSeule: () => null }))
vi.mock('@/lib/commercial/verrou-lot', () => ({ verrouillerRecolteLibre: mocks.verrou }))
vi.mock('@/lib/auto-compta', () => ({ deleteAutoEntry: mocks.deleteAutoEntry }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      culture: { findFirst: mocks.cultureFindFirst, update: mocks.cultureUpdate },
      recolte: { findMany: mocks.recolteFindMany, delete: mocks.recolteDelete },
    }),
  },
}))

import { POST } from './route'
import { ErreurCommerciale } from '@/lib/commercial/regles'

const annuler = () => POST(
  new NextRequest('http://localhost/api/cultures/42/annuler-recolte', { method: 'POST' }),
  { params: Promise.resolve({ id: '42' }) },
)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verrou.mockReset()
  mocks.verrou.mockImplementation(async (_tx: unknown, _userId: string, id: number) => ({ id, statut: 'en_stock' }))
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.cultureFindFirst.mockResolvedValue({
    id: 42, recolteFaite: true, finRecolte: null,
    dateSemis: null, datePlantation: null, dateRecolte: new Date('2026-08-10T00:00:00Z'),
    dateSemisPlan: null, datePlantationPlan: null, dateRecoltePlan: new Date('2026-08-20T00:00:00Z'),
  })
})

describe('POST /api/cultures/[id]/annuler-recolte', () => {
  it('refuse en 409 sans RIEN supprimer quand une récolte est vendue', async () => {
    mocks.recolteFindMany.mockResolvedValue([
      { id: 1, statut: 'en_stock' }, { id: 2, statut: 'en_stock' }, { id: 3, statut: 'vendu' },
    ])
    const res = await annuler()
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('1 récolte vendue')
    expect(json.error).toContain("Rien n'a été supprimé")
    expect(mocks.recolteDelete).not.toHaveBeenCalled()
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  it('retire les lots en stock et repasse l’étape à faire, avec la date du plan', async () => {
    mocks.recolteFindMany.mockResolvedValue([{ id: 1, statut: 'en_stock' }, { id: 2, statut: null }])
    const res = await annuler()
    expect(res.status).toBe(200)
    expect((await res.json()).recoltesSupprimees).toBe(2)
    expect(mocks.verrou).toHaveBeenCalledTimes(2)
    expect(mocks.deleteAutoEntry).toHaveBeenCalledWith('recolte', 1, 'vente', 'user-1', expect.anything())
    expect(mocks.recolteDelete).toHaveBeenCalledTimes(2)
    expect(mocks.cultureUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { recolteFaite: false, dateRecolte: new Date('2026-08-20T00:00:00Z'), dateRecoltePlan: null },
    })
  })

  it('un lot suivi par un bon de livraison refuse toute l’annulation (409 du verrou commercial)', async () => {
    mocks.recolteFindMany.mockResolvedValue([{ id: 1, statut: 'en_stock' }])
    mocks.verrou.mockRejectedValue(new ErreurCommerciale('Ce lot est lié à un document commercial.'))
    const res = await annuler()
    expect(res.status).toBe(409)
    expect(mocks.cultureUpdate).not.toHaveBeenCalled()
  })

  // Revue Codex MAR-01 (2026-11-12) : le statut lu avant le verrou commercial
  // peut être périmé. Une vente directe qui prend le verrou d'abord passe le lot
  // en « vendu » ; l'annulation effaçait ensuite la récolte vendue et sa recette.
  for (const statut of ['vendu', 'consomme', 'perte'] as const) {
    it(`refuse sans rien supprimer un lot passé « ${statut} » pendant l’attente du verrou`, async () => {
      mocks.recolteFindMany.mockResolvedValue([{ id: 1, statut: 'en_stock' }, { id: 2, statut: 'en_stock' }])
      mocks.verrou.mockImplementation(async (_tx: unknown, _userId: string, id: number) =>
        ({ id, statut: id === 2 ? statut : 'en_stock' }))
      const res = await annuler()
      expect(res.status).toBe(409)
      expect((await res.json()).error).toContain("Rien n'a été supprimé")
      expect(mocks.deleteAutoEntry).not.toHaveBeenCalled()
      expect(mocks.recolteDelete).not.toHaveBeenCalled()
      expect(mocks.cultureUpdate).not.toHaveBeenCalled()
    })
  }
})
