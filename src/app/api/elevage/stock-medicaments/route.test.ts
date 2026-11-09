import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(), produitFindUnique: vi.fn(),
  stockFindUnique: vi.fn(), stockCreate: vi.fn(), stockUpdate: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: {
  produitVeterinaire: { findUnique: mocks.produitFindUnique },
  stockMedicamentElevage: { findUnique: mocks.stockFindUnique, create: mocks.stockCreate, update: mocks.stockUpdate },
} }))

import { POST } from './route'

const post = (body: object) => POST(new NextRequest('http://localhost/api/elevage/stock-medicaments', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
}))
const lot = { produitId: 'p1', numeroLot: 'LOT-1', quantite: 50, unite: 'mL', ordonnanceUrl: null, fournisseur: null, notes: null }
const enPharmacie = {
  id: 's1', userId: 'user-1', produitId: 'p1', numeroLot: 'LOT-1', quantite: 12, unite: 'mL',
  ordonnanceUrl: 'https://exemple.test/ordonnance.pdf', fournisseur: 'Clinique', notes: 'Flacon entamé', _count: { soins: 2 },
}

describe('POST /api/elevage/stock-medicaments — ressaisie d’un lot existant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.produitFindUnique.mockResolvedValue({ id: 'p1' })
    mocks.stockCreate.mockImplementation(async ({ data }) => ({ id: 's-new', ...data }))
    mocks.stockUpdate.mockImplementation(async ({ data }) => ({ ...enPharmacie, ...data }))
  })

  it('crée un lot nouveau', async () => {
    mocks.stockFindUnique.mockResolvedValue(null)
    expect((await post(lot)).status).toBe(201)
    expect(mocks.stockCreate).toHaveBeenCalledTimes(1)
  })

  it('n’efface ni l’ordonnance, ni le fournisseur, ni les notes laissés vides', async () => {
    mocks.stockFindUnique.mockResolvedValue(enPharmacie)
    expect((await post(lot)).status).toBe(201)
    const { data, where } = mocks.stockUpdate.mock.calls[0][0]
    expect(where).toEqual({ id: 's1' })
    expect(data).toMatchObject({ quantite: 50, unite: 'mL' })
    expect(data.ordonnanceUrl).toBeUndefined()
    expect(data.fournisseur).toBeUndefined()
    expect(data.notes).toBeUndefined()
  })

  it('refuse (409) de changer l’unité d’un lot qui porte des soins', async () => {
    mocks.stockFindUnique.mockResolvedValue(enPharmacie)
    const res = await post({ ...lot, unite: 'flacons' })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('UNITE_LOT_FIGEE')
    expect(mocks.stockUpdate).not.toHaveBeenCalled()
  })
})
