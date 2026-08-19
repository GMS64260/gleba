import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  isAssignableAnimalLot: vi.fn(),
  animalFindFirst: vi.fn(),
  animalUpdate: vi.fn(),
  enregistrerChangementLot: vi.fn(),
  soinFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/animal-lot', () => ({
  isAssignableAnimalLot: mocks.isAssignableAnimalLot,
  enregistrerChangementLot: mocks.enregistrerChangementLot,
}))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromAchatAnimal: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: (callback: (tx: unknown) => unknown) => callback({ animal: { update: mocks.animalUpdate } }),
    animal: { findFirst: mocks.animalFindFirst, update: mocks.animalUpdate },
    // Ticket cmsoglwee — le GET fusionne les soins du lot de l'animal.
    soinAnimal: { findMany: mocks.soinFindMany },
  },
}))

import { GET, PUT } from './route'

const callPut = (body: object) => PUT(
  new NextRequest('http://localhost/api/elevage/animaux/7', { method: 'PUT', body: JSON.stringify(body) }),
  { params: Promise.resolve({ id: '7' }) }
)

// Ticket cmsoglwee — les soins de LOT n'apparaissaient pas sur la fiche d'un
// animal membre : le GET doit fusionner les soins du lot (marqués viaLot) pour
// que la timeline et l'alerte de délai d'attente les voient.
describe('GET /api/elevage/animaux/[id] — soins du lot fusionnés', () => {
  const callGet = () => GET(
    new NextRequest('http://localhost/api/elevage/animaux/7'),
    { params: Promise.resolve({ id: '7' }) }
  )

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.soinFindMany.mockResolvedValue([])
  })

  it('fusionne les soins du lot de l’animal, marqués viaLot et triés par date', async () => {
    mocks.animalFindFirst.mockResolvedValue({
      id: 7,
      lotId: 58,
      soins: [{ id: 1, date: new Date('2026-08-01T00:00:00Z'), type: 'Vaccination', fait: true }],
    })
    mocks.soinFindMany.mockResolvedValue([{
      id: 95,
      date: new Date('2026-08-08T00:00:00Z'),
      type: 'Vermifuge',
      produit: 'Dectomax',
      fait: true,
      finAttenteLait: new Date('2026-09-08T00:00:00Z'),
      animalId: null,
      lotId: 58,
    }])

    const response = await callGet()

    expect(response.status).toBe(200)
    const { data } = await response.json()
    expect(mocks.soinFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-1', lotId: 58 },
    }))
    expect(data.soins.map((s: { id: number }) => s.id)).toEqual([95, 1])
    expect(data.soins[0].viaLot).toBe(true)
    expect(data.soins[0].finAttenteLait).toBe('2026-09-08T00:00:00.000Z')
    expect(data.soins[1].viaLot).toBeUndefined()
  })

  it('ne requête pas les soins de lot pour un animal sans lot', async () => {
    mocks.animalFindFirst.mockResolvedValue({
      id: 7,
      lotId: null,
      soins: [{ id: 1, date: new Date('2026-08-01T00:00:00Z'), type: 'Vaccination', fait: true }],
    })

    const response = await callGet()

    expect(response.status).toBe(200)
    expect(mocks.soinFindMany).not.toHaveBeenCalled()
    const { data } = await response.json()
    expect(data.soins).toHaveLength(1)
  })
})

describe('affectation d’un lot via PUT /api/elevage/animaux/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.animalFindFirst.mockResolvedValue({ id: 7, especeAnimaleId: 'ovin' })
    mocks.animalUpdate.mockImplementation(async ({ data }) => ({ id: 7, lotId: data.lotId ?? 42, prixAchat: null }))
  })

  it('refuse un lot non assignable avant écriture', async () => {
    mocks.isAssignableAnimalLot.mockResolvedValue(false)

    const response = await callPut({ lotId: 42 })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Lot invalide' })
    expect(mocks.animalUpdate).not.toHaveBeenCalled()
  })

  it('valide le lot contre l’espèce finale de l’animal', async () => {
    mocks.isAssignableAnimalLot.mockResolvedValue(true)

    await callPut({ lotId: 42, especeAnimaleId: 'caprin' })

    expect(mocks.isAssignableAnimalLot).toHaveBeenCalledWith('user-1', 42, 'caprin')
    expect(mocks.animalUpdate).toHaveBeenCalled()
  })

  it('permet le détachement sans rechercher de lot', async () => {
    await callPut({ lotId: null })

    expect(mocks.isAssignableAnimalLot).not.toHaveBeenCalled()
    expect(mocks.animalUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lotId: null }) }))
  })

  it('ne revalide pas un lot inchangé (animal déjà dans un lot devenu inactif)', async () => {
    mocks.animalFindFirst.mockResolvedValue({ id: 7, especeAnimaleId: 'ovin', lotId: 42 })
    mocks.isAssignableAnimalLot.mockResolvedValue(false)

    const response = await callPut({ lotId: 42, poidsActuel: 55 })

    expect(response.status).toBe(200)
    expect(mocks.isAssignableAnimalLot).not.toHaveBeenCalled()
    expect(mocks.animalUpdate).toHaveBeenCalled()
  })
})
