import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
  animalUpdate: vi.fn(),
  enregistrerChangementLot: vi.fn(),
  createDepenseFromAchatAnimal: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromAchatAnimal: mocks.createDepenseFromAchatAnimal }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/elevage/animal-lot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/elevage/animal-lot')>()),
  enregistrerChangementLot: mocks.enregistrerChangementLot,
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    lotAnimaux: { findFirst: mocks.lotFindFirst },
    animal: { findMany: mocks.animalFindMany },
    $transaction: (callback: (tx: unknown) => unknown) => callback({ animal: { update: mocks.animalUpdate } }),
  },
}))

import { POST } from './route'

const params = Promise.resolve({ id: '81' })
const post = (body: object) => POST(
  new NextRequest('http://localhost/api/elevage/lots/81/animaux', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }),
  { params },
)

const chevre = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  nom: `Chèvre ${id}`,
  identifiant: null,
  statut: 'actif',
  especeAnimaleId: 'chevre_alpine',
  lotId: null,
  prixAchat: null,
  prixAchatInclusDansLot: false,
  dateArrivee: null,
  ...over,
})

describe('POST /api/elevage/lots/[id]/animaux — composer un lot en une fois', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.lotFindFirst.mockResolvedValue({
      id: 81, nom: 'adultes traite 2025', statut: 'actif', especeAnimaleId: 'chevre', prixAchatTotal: null,
    })
  })

  it('rattache et retire en une transaction, avec l’historique de chaque animal', async () => {
    mocks.animalFindMany.mockResolvedValue([
      chevre(1, { lotId: 79 }),
      chevre(2),
      chevre(3, { lotId: 81 }),
      chevre(4, { lotId: 81 }),
    ])

    const res = await post({ ajouter: [1, 2, 3], retirer: [4] })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { ajoutes: 2, retires: 1 } })
    expect(mocks.animalUpdate).toHaveBeenCalledTimes(3)
    expect(mocks.animalUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { lotId: 81, prixAchatInclusDansLot: false } })
    expect(mocks.animalUpdate).toHaveBeenCalledWith({ where: { id: 4 }, data: { lotId: null, prixAchatInclusDansLot: false } })
    expect(mocks.enregistrerChangementLot).toHaveBeenCalledWith(
      expect.anything(), 'user-1', 1, 79, 81, expect.any(Date), 'Composition du lot',
    )
    expect(mocks.animalFindMany.mock.calls[0][0].where.userId).toBe('user-1')
  })

  it('refuse tout, sans rien écrire, si un animal ne peut pas entrer dans le lot', async () => {
    mocks.animalFindMany.mockResolvedValue([
      chevre(1),
      chevre(2, { especeAnimaleId: 'brebis_lacaune' }),
      chevre(3, { statut: 'vendu' }),
    ])

    const res = await post({ ajouter: [1, 2, 3] })

    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(payload.details.map((d: { animalId: number }) => d.animalId)).toEqual([2, 3])
    expect(payload.error).toContain('espèce différente')
    expect(mocks.animalUpdate).not.toHaveBeenCalled()
  })

  it('refuse d’ajouter à un lot clôturé', async () => {
    mocks.lotFindFirst.mockResolvedValue({ id: 81, nom: 'x', statut: 'termine', especeAnimaleId: 'chevre', prixAchatTotal: null })

    const res = await post({ ajouter: [1] })

    expect(res.status).toBe(409)
    expect(mocks.animalFindMany).not.toHaveBeenCalled()
  })

  it('répond 404 pour un animal d’un autre compte', async () => {
    mocks.animalFindMany.mockResolvedValue([chevre(1)])

    const res = await post({ ajouter: [1, 999] })

    expect(res.status).toBe(404)
    expect(mocks.animalUpdate).not.toHaveBeenCalled()
  })
})
