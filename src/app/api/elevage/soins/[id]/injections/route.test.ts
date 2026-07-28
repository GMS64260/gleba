import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  soinFindFirst: vi.fn(),
  soinUpdate: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  syncDepense: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/injections', () => ({
  ajouterJours: (date: Date, jours: number) => new Date(date.getTime() + jours * 86_400_000),
  derniereInjectionActive: (injections: Array<{ statut: string; dateRealisee: Date | null; datePrevue: Date }>) =>
    injections
      .filter((injection) => injection.statut !== 'annulee')
      .map((injection) => injection.dateRealisee ?? injection.datePrevue)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
}))
vi.mock('@/lib/elevage/attente-lait', () => ({
  ciblesAffectees: vi.fn().mockResolvedValue([]),
  resyncEcartementLait: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/auto-compta', () => ({
  createDepenseFromSoinAnimal: mocks.syncDepense,
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    soinAnimal: { update: mocks.soinUpdate },
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  }
  return {
    default: {
      soinAnimal: { findFirst: mocks.soinFindFirst },
      $queryRaw: mocks.queryRaw,
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  }
})

import { PATCH } from './route'

describe('synchronisation comptable des injections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1' } },
    })
    mocks.soinFindFirst.mockResolvedValue({
      id: 12,
      userId: 'user-1',
      animalId: 7,
      lotId: null,
      date: new Date('2026-07-20T00:00:00Z'),
      type: 'Vaccination',
      cout: 24,
      finAttenteLait: null,
      tempsAttenteLaitJ: 3,
      tempsAttenteViandeJ: 7,
    })
    mocks.queryRaw
      .mockResolvedValueOnce([{
        id: 'inj-1',
        numero: 1,
        datePrevue: new Date('2026-07-26T00:00:00Z'),
        dateRealisee: null,
        statut: 'a_faire',
      }])
      .mockResolvedValueOnce([{
        id: 'inj-1',
        numero: 1,
        datePrevue: new Date('2026-07-26T00:00:00Z'),
        dateRealisee: new Date('2026-07-26T00:00:00Z'),
        statut: 'realisee',
      }])
    mocks.executeRaw.mockResolvedValue(1)
    mocks.soinUpdate.mockResolvedValue({
      id: 12,
      type: 'Vaccination',
      cout: 24,
      date: new Date('2026-07-20T00:00:00Z'),
      fait: true,
      finAttenteLait: new Date('2026-07-29T00:00:00Z'),
    })
    mocks.syncDepense.mockResolvedValue({})
  })

  it('rend le soin effectif et synchronise son coût dans la transaction', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/elevage/soins/12/injections', {
        method: 'PATCH',
        body: JSON.stringify({
          injectionId: 'inj-1',
          statut: 'realisee',
          dateRealisee: '2026-07-26',
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: '12' }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.soinUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fait: true }),
    }))
    expect(mocks.syncDepense).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 12, fait: true, cout: 24 }),
      expect.objectContaining({ soinAnimal: expect.any(Object) }),
    )
    expect(mocks.invalidateKpi).toHaveBeenCalledWith('user-1')
  })
})
