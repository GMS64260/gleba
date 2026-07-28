import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(), animalFindFirst: vi.fn(), produitFindUnique: vi.fn(),
  soinCreate: vi.fn(), soinFindFirst: vi.fn(), soinUpdate: vi.fn(),
  collecteUpdateMany: vi.fn(), collecteFindMany: vi.fn(), soinFindMany: vi.fn(),
  soinCount: vi.fn(), animalFindMany: vi.fn(), queryRaw: vi.fn(), executeRaw: vi.fn(),
  stockFindFirst: vi.fn(), stockUpdateMany: vi.fn(), stockUpdate: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromSoinAnimal: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    // Review caprin 2026-07-22 — l'écartement passe par la lib attente-lait, qui
    // interroge aussi `animal` (appartenance lot ↔ membres) dans la transaction.
    animal: { findFirst: mocks.animalFindFirst, findMany: mocks.animalFindMany },
    soinAnimal: { create: mocks.soinCreate, update: mocks.soinUpdate, findMany: mocks.soinFindMany },
    collecteLait: { updateMany: mocks.collecteUpdateMany, findMany: mocks.collecteFindMany },
    stockMedicamentElevage: { updateMany: mocks.stockUpdateMany, update: mocks.stockUpdate },
    $queryRaw: mocks.queryRaw,
    $executeRaw: mocks.executeRaw,
  }
  return { default: {
    animal: { findFirst: mocks.animalFindFirst },
    lotAnimaux: { findFirst: vi.fn() },
    produitVeterinaire: { findUnique: mocks.produitFindUnique },
    soinAnimal: { findFirst: mocks.soinFindFirst, findMany: mocks.soinFindMany, count: mocks.soinCount },
    stockMedicamentElevage: { findFirst: mocks.stockFindFirst },
    $queryRaw: mocks.queryRaw,
    $transaction: vi.fn(async (callback: (arg: typeof tx) => unknown) => callback(tx)),
  } }
})

import { GET, PATCH, POST } from './route'

const request = (method: string, body: object) => new NextRequest('http://localhost/api/elevage/soins', {
  method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
})

describe('soins planifies et temps attente lait', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.animalFindFirst.mockResolvedValue({ id: 7 })
    mocks.produitFindUnique.mockResolvedValue({ id: 'p1', nom: 'Traitement', tempsAttenteLaitJ: 5, tempsAttenteViandeJ: 12 })
    mocks.collecteFindMany.mockResolvedValue([])
    mocks.soinFindMany.mockResolvedValue([])
    mocks.soinCount.mockResolvedValue(0)
    mocks.animalFindMany.mockResolvedValue([])
    mocks.collecteUpdateMany.mockResolvedValue({ count: 0 })
    mocks.queryRaw.mockResolvedValue([])
    mocks.executeRaw.mockResolvedValue(1)
    mocks.stockFindFirst.mockResolvedValue({
      id: 'stock-1',
      userId: 'user-1',
      produitId: 'p1',
      numeroLot: 'LOT-2026',
      quantite: 100,
      unite: 'mL',
      datePeremption: new Date('2027-01-01'),
      ordonnanceUrl: null,
    })
    mocks.stockUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('ne demarre pas les temps attente pour un soin seulement planifie', async () => {
    mocks.soinCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    const response = await POST(request('POST', {
      animalId: 7,
      date: '2026-07-21',
      type: 'Traitement vétérinaire',
      produitId: 'p1',
      stockMedicamentId: 'stock-1',
      quantite: 2,
      unite: 'mL',
      fait: false,
    }))
    expect(response.status).toBe(201)
    expect(mocks.soinCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      tempsAttenteLaitJ: 5, finAttenteLait: null, finAttenteViande: null,
    }) }))
    expect(mocks.collecteUpdateMany).not.toHaveBeenCalled()
  })

  it('active les temps attente lors du passage du soin a realise', async () => {
    const existing = { id: 1, userId: 'user-1', animalId: 7, lotId: null, date: new Date('2026-07-21T00:00:00Z'), fait: false, tempsAttenteLaitJ: 5, tempsAttenteViandeJ: 12, finAttenteLait: null, finAttenteViande: null, cout: null, type: 'Traitement vétérinaire' }
    mocks.soinFindFirst.mockResolvedValue(existing)
    mocks.soinUpdate.mockImplementation(async ({ data }) => ({ ...existing, ...data }))
    const response = await PATCH(request('PATCH', { id: 1, fait: true }))
    expect(response.status).toBe(200)
    expect(mocks.soinUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      fait: true, finAttenteLait: new Date('2026-07-26T00:00:00Z'), finAttenteViande: new Date('2026-08-02T00:00:00Z'),
    }) }))
  })

  it('charge les rappels sans filtre annuel ni plafond et les scope par filière', async () => {
    mocks.soinFindMany.mockResolvedValue([])

    const response = await GET(new NextRequest(
      'http://localhost/api/elevage/soins?rappels=1&filiere=compagnie'
    ))

    expect(response.status).toBe(200)
    expect(mocks.soinFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1',
        fait: false,
        datePrevue: { not: null },
        OR: [
          { animal: { especeAnimale: { filiere: 'compagnie' } } },
          { lot: { especeAnimale: { filiere: 'compagnie' } } },
        ],
      }),
    }))
    const query = mocks.soinFindMany.mock.calls[0][0]
    expect(query.where).not.toHaveProperty('date')
    expect(query).not.toHaveProperty('take')
  })
})
