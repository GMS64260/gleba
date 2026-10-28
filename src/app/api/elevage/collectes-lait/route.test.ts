/**
 * Collectes de lait — le lot de fromage se vérifie au compte (POST et PATCH).
 *
 * Audit 2026-10-19 : `lotFromageId` s'écrivait sans contrôle, et la collecte
 * apparaissait dans le lot de fabrication d'un autre compte.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  collecteFindFirst: vi.fn(),
  collecteUpdate: vi.fn(),
  collecteCreate: vi.fn(),
  lotFromageFindFirst: vi.fn(),
  animalFindFirst: vi.fn(),
  lotFindFirst: vi.fn(),
  plafondCollecteLait: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/attente-lait', () => ({
  causesAttenteCollectes: vi.fn(),
  soinCouvrantCollecte: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/elevage/cibles-collecte-lait', () => ({
  estAnimalCollectableLait: () => true,
  estLotCollectableLait: () => true,
  plafondCollecteLait: mocks.plafondCollecteLait,
}))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock('@/lib/prisma', () => {
  const db = {
    collecteLait: {
      findFirst: mocks.collecteFindFirst,
      update: mocks.collecteUpdate,
      create: mocks.collecteCreate,
    },
    lotFromage: { findFirst: mocks.lotFromageFindFirst },
    animal: { findFirst: mocks.animalFindFirst },
    lotAnimaux: { findFirst: mocks.lotFindFirst },
  }; return { default: { ...db, $transaction: (fn: (tx: unknown) => unknown) => fn({ ...db, $executeRaw: vi.fn() }) } }
})

import { PATCH, POST } from './route'

const patch = (body: object) => PATCH(new NextRequest('http://localhost/api/elevage/collectes-lait', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
  mocks.collecteFindFirst.mockResolvedValue({
    id: 'c1',
    userId: 'user-1',
    animalId: null,
    lotId: null,
    date: new Date('2026-10-01T00:00:00Z'),
  })
  mocks.collecteUpdate.mockImplementation(async ({ data }: { data: object }) => ({ id: 'c1', ...data }))
  mocks.plafondCollecteLait.mockReturnValue(null)
})

// Revue 2026-10-20 — le plafond indicatif d'une traite de lot se calcule sur
// l'effectif reconstitué (écran Lots), pas sur le compteur stocké qui dérive.
describe('POST /api/elevage/collectes-lait — effectif du lot', () => {
  it('passe l’effectif reconstitué au plafond de traite', async () => {
    const lot = {
      id: 58,
      quantiteInitiale: 2,
      quantiteActuelle: 5,
      especeAnimale: { nom: 'Chèvre', production: 'lait', productions: ['Lait'] },
    }
    mocks.lotFindFirst.mockResolvedValue(lot)
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([[58, { effectifCalcule: 4 }]]))
    mocks.plafondCollecteLait.mockReturnValue(1)
    mocks.collecteFindFirst.mockResolvedValue(null)

    const res = await POST(new NextRequest('http://localhost/api/elevage/collectes-lait', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date: '2026-10-20', traite: 'Matin', lotId: 58, quantiteLitres: 3 }),
    }))

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith('user-1', [lot])
    expect(mocks.plafondCollecteLait).toHaveBeenCalledWith('Chèvre', 'lot', 4)
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('VOLUME_LAIT_INHABITUEL')
  })
})

describe('PATCH /api/elevage/collectes-lait — lotFromageId', () => {
  it('refuse le lot de fromage d’un autre compte en nommant le champ', async () => {
    mocks.lotFromageFindFirst.mockResolvedValue(null)

    const res = await patch({ id: 'c1', lotFromageId: 'lot-autre-compte' })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'Lot de fromage introuvable dans votre cave.',
      champ: 'lotFromageId',
    })
    expect(mocks.lotFromageFindFirst).toHaveBeenCalledWith({
      where: { id: 'lot-autre-compte', userId: 'user-1' },
      select: { id: true },
    })
    expect(mocks.collecteUpdate).not.toHaveBeenCalled()
  })

  it('rattache à un lot de la cave du compte', async () => {
    mocks.lotFromageFindFirst.mockResolvedValue({ id: 'lot-1' })

    const res = await patch({ id: 'c1', lotFromageId: 'lot-1' })

    expect(res.status).toBe(200)
    expect(mocks.collecteUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lotFromageId: 'lot-1' }),
    }))
  })
})
