import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  createDepenseFromLotAnimaux: vi.fn(),
  lotFindFirst: vi.fn(),
  lotUpdate: vi.fn(),
  especeFindUnique: vi.fn(),
  isOwnedParcelle: vi.fn(),
  animalFindMany: vi.fn(),
  animalUpdateMany: vi.fn(),
  createDepenseFromAchatAnimal: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/animal-lot', () => ({ isOwnedParcelle: mocks.isOwnedParcelle }))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock('@/lib/auto-compta', () => ({
  createDepenseFromLotAnimaux: mocks.createDepenseFromLotAnimaux,
  createDepenseFromAchatAnimal: mocks.createDepenseFromAchatAnimal,
  deleteAutoEntry: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      lotAnimaux: { update: mocks.lotUpdate },
      mouvementCheptel: { create: vi.fn() },
      animal: { findMany: mocks.animalFindMany, updateMany: mocks.animalUpdateMany },
    }),
    lotAnimaux: { findFirst: mocks.lotFindFirst, update: mocks.lotUpdate },
    especeAnimale: { findUnique: mocks.especeFindUnique },
  },
}))

import { PATCH } from './route'

const request = (body: object) => new NextRequest('http://localhost/api/elevage/lots', {
  method: 'PATCH',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

describe('PATCH /api/elevage/lots (édition complète + resync compta)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.lotFindFirst.mockResolvedValue({ id: 5, userId: 'user-1', parcelleGeoId: null })
    mocks.lotUpdate.mockResolvedValue({ id: 5, nom: 'Poules', prixAchatTotal: 0, dateArrivee: null })
    mocks.animalFindMany.mockResolvedValue([])
  })

  it('applique prixAchatTotal (0 compris) et resynchronise la dépense d’achat', async () => {
    const res = await PATCH(request({ id: 5, prixAchatTotal: 0, nom: 'Poules' }))

    expect(res.status).toBe(200)
    expect(mocks.lotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prixAchatTotal: 0, nom: 'Poules' }) })
    )
    expect(mocks.createDepenseFromLotAnimaux).toHaveBeenCalledTimes(1)
  })

  it('rejette une date d’arrivée hors bornes (faute d’année type 0204)', async () => {
    const res = await PATCH(request({ id: 5, dateArrivee: '0204-06-03' }))

    expect(res.status).toBe(400)
    expect(mocks.lotUpdate).not.toHaveBeenCalled()
  })
})

// Ticket cms1vdxcj — clôture d'un lot refusée tant que l'effectif reconstitué
// n'est pas soldé (registre cohérent), sauf forcerCloture explicite.
describe('PATCH /api/elevage/lots (clôture vs effectif restant)', () => {
  const lotExistant = {
    id: 5, userId: 'user-1', parcelleGeoId: null,
    statut: 'actif', quantiteInitiale: 10, quantiteActuelle: 3,
  }
  const effectifMap = (effectifCalcule: number) => new Map([[5, {
    naissancesVivantes: 0, abattagesTotal: 0, effectifCalcule, nominatifsActifs: 0,
  }]])

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.lotFindFirst.mockResolvedValue(lotExistant)
    mocks.lotUpdate.mockResolvedValue({ ...lotExistant, statut: 'termine' })
    mocks.animalFindMany.mockResolvedValue([])
  })

  it('refuse (409 LOT_NON_SOLDE) la clôture quand il reste des têtes', async () => {
    mocks.reconstituerEffectifsLots.mockResolvedValue(effectifMap(3))

    const res = await PATCH(request({ id: 5, statut: 'termine' }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.code).toBe('LOT_NON_SOLDE')
    expect(body.effectifRestant).toBe(3)
    expect(body.error).toContain('3 tête(s)')
    expect(mocks.lotUpdate).not.toHaveBeenCalled()
  })

  it('accepte la clôture quand l’effectif reconstitué est à 0', async () => {
    mocks.reconstituerEffectifsLots.mockResolvedValue(effectifMap(0))

    const res = await PATCH(request({ id: 5, statut: 'termine' }))

    expect(res.status).toBe(200)
    expect(mocks.lotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: 'termine' }) })
    )
  })

  it('accepte la clôture forcée (forcerCloture: true) malgré un effectif > 0', async () => {
    mocks.reconstituerEffectifsLots.mockResolvedValue(effectifMap(3))

    const res = await PATCH(request({ id: 5, statut: 'reforme', forcerCloture: true }))

    expect(res.status).toBe(200)
    expect(mocks.reconstituerEffectifsLots).not.toHaveBeenCalled()
    expect(mocks.lotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: 'reforme' }) })
    )
  })
})
