import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  soinFindFirst: vi.fn(),
  soinUpdate: vi.fn(),
  animalFindFirst: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  syncDepense: vi.fn(),
  invalidateKpi: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/attente-lait', () => ({
  ciblesLaitAffectees: vi.fn().mockResolvedValue([]),
  resyncEcartementLait: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/auto-compta', () => ({
  createDepenseFromSoinAnimal: mocks.syncDepense,
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: mocks.invalidateKpi }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    soinAnimal: { update: mocks.soinUpdate, findFirst: mocks.soinFindFirst },
    animal: { findFirst: mocks.animalFindFirst },
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  }
  return {
    default: {
      soinAnimal: { findFirst: mocks.soinFindFirst },
      animal: { findFirst: mocks.animalFindFirst },
      $queryRaw: mocks.queryRaw,
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    },
  }
})

import { PATCH } from './route'

describe('validation et synchronisation comptable des injections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryRaw.mockReset()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1' } },
    })
    mocks.soinFindFirst.mockResolvedValue({
      id: 12,
      userId: 'user-1',
      animalId: 7,
      lotId: null,
      fait: false,
      produitId: null,
      date: new Date('2026-07-20T00:00:00Z'),
      type: 'Vaccination',
      cout: 24,
      finAttenteLait: null,
      tempsAttenteLaitJ: 3,
      tempsAttenteViandeJ: 7,
      tempsAttenteOeufsJ: null,
    })
    mocks.animalFindFirst.mockResolvedValue({
      sexe: 'male', orientationProduction: 'viande',
      especeAnimale: { type: 'mammifere_grand', production: 'viande', productions: [] },
    })
    mocks.queryRaw
      .mockResolvedValueOnce([{
        id: 'inj-1',
        numero: 1,
        datePrevue: new Date('2026-07-26T00:00:00Z'),
        dateRealisee: null,
        statut: 'a_faire',
      }])
      // Relecture sous le verrou (CR-SOI-01) : inchangée.
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

  it('refuse de réaliser un soin médicamenteux sans délai viande et ne fait aucune écriture', async () => {
    const soin = await mocks.soinFindFirst()
    mocks.soinFindFirst.mockResolvedValue({ ...soin, tempsAttenteLaitJ: null, tempsAttenteViandeJ: null })

    const response = await PATCH(
      new NextRequest('http://localhost/api/elevage/soins/12/injections', {
        method: 'PATCH',
        body: JSON.stringify({ injectionId: 'inj-1', statut: 'realisee', dateRealisee: '2026-07-26' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: '12' }) },
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ code: 'DELAIS_ATTENTE_REQUIS', delaisManquants: ['viande'] })
    expect(mocks.animalFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, userId: 'user-1' } }))
    expect(mocks.executeRaw).not.toHaveBeenCalled()
    expect(mocks.soinUpdate).not.toHaveBeenCalled()
    expect(mocks.syncDepense).not.toHaveBeenCalled()
    expect(mocks.invalidateKpi).not.toHaveBeenCalled()
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
      data: expect.objectContaining({
        fait: true,
        finAttenteLait: new Date('2026-07-29T00:00:00Z'),
        finAttenteViande: new Date('2026-08-02T00:00:00Z'),
        finAttenteOeufs: null,
      }),
    }))
    expect(mocks.syncDepense).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 12, fait: true, cout: 24 }),
      // Le client de la TRANSACTION (lui seul porte `update`), pas le client global.
      expect.objectContaining({ soinAnimal: expect.objectContaining({ update: expect.any(Function) }) }),
    )
    expect(mocks.invalidateKpi).toHaveBeenCalledWith('user-1')
  })
})
