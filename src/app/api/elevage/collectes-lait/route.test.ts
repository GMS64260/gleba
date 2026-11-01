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

// Revue du 2026-11-01 — la traite d'un grand lot de chèvres (120 L) était refusée
// par une borne fixe de 100 L, même confirmée ; seul le plafond indicatif par
// espèce et effectif doit demander confirmation, en saisie comme en correction.
describe('collectes-lait — traite collective au-delà de 100 L', () => {
  const troupeau = {
    id: 77,
    quantiteInitiale: 90,
    quantiteActuelle: 90,
    especeAnimale: { nom: 'Chèvre Alpine', production: 'lait', productions: ['Lait'] },
  }
  const post = (body: object) => POST(new NextRequest('http://localhost/api/elevage/collectes-lait', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date: '2026-11-01', traite: 'Matin', lotId: 77, ...body }),
  }))

  beforeEach(() => {
    mocks.lotFindFirst.mockResolvedValue(troupeau)
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([[77, { effectifCalcule: 90 }]]))
    mocks.collecteCreate.mockImplementation(async ({ data }: { data: object }) => ({ id: 'n1', ...data }))
  })

  it('enregistre 120 L sous le plafond du troupeau sans confirmation', async () => {
    mocks.plafondCollecteLait.mockReturnValue(720)
    mocks.collecteFindFirst.mockResolvedValue(null)

    const res = await post({ quantiteLitres: 120 })

    expect(res.status).toBe(201)
    expect(mocks.collecteCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ quantiteLitres: 120, lotId: 77 }) })
  })

  it('demande confirmation au-dessus du plafond, puis enregistre une fois confirmé', async () => {
    mocks.plafondCollecteLait.mockReturnValue(100)
    mocks.collecteFindFirst.mockResolvedValue(null)

    const refus = await post({ quantiteLitres: 120 })
    expect(refus.status).toBe(422)
    expect((await refus.json()).code).toBe('VOLUME_LAIT_INHABITUEL')

    const confirme = await post({ quantiteLitres: 120, confirmerVolumeInhabituel: true })
    expect(confirme.status).toBe(201)
  })

  it('garde une borne technique contre les saisies absurdes', async () => {
    const res = await post({ quantiteLitres: 25000, confirmerVolumeInhabituel: true })

    expect(res.status).toBe(400)
    expect(mocks.collecteCreate).not.toHaveBeenCalled()
  })

  it('applique le plafond indicatif à la correction du volume', async () => {
    mocks.plafondCollecteLait.mockReturnValue(100)
    mocks.collecteFindFirst.mockResolvedValue({
      id: 'c1', userId: 'user-1', animalId: null, lotId: 77, quantiteLitres: 90, lotFromageId: null,
      date: new Date('2026-11-01T00:00:00Z'),
    })

    const refus = await patch({ id: 'c1', quantiteLitres: 120 })
    expect(refus.status).toBe(422)
    expect(mocks.collecteUpdate).not.toHaveBeenCalled()

    const confirme = await patch({ id: 'c1', quantiteLitres: 120, confirmerVolumeInhabituel: true })
    expect(confirme.status).toBe(200)
    const data = mocks.collecteUpdate.mock.calls[0][0].data
    expect(data.quantiteLitres).toBe(120)
    expect(data).not.toHaveProperty('confirmerVolumeInhabituel')
  })

  it('ne replafonne pas une correction qui ne change pas le volume', async () => {
    mocks.plafondCollecteLait.mockReturnValue(100)
    mocks.collecteFindFirst.mockResolvedValue({
      id: 'c1', userId: 'user-1', animalId: null, lotId: 77, quantiteLitres: 150, lotFromageId: null,
      date: new Date('2026-11-01T00:00:00Z'),
    })

    const res = await patch({ id: 'c1', quantiteLitres: 150, notes: 'traite confirmée' })

    expect(res.status).toBe(200)
    expect(mocks.plafondCollecteLait).not.toHaveBeenCalled()
  })
})
