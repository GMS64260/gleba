import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  isAssignableAnimalLot: vi.fn(),
  animalFindFirst: vi.fn(),
  animalUpdate: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/animal-lot', () => ({ isAssignableAnimalLot: mocks.isAssignableAnimalLot }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromAchatAnimal: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: { animal: { findFirst: mocks.animalFindFirst, update: mocks.animalUpdate } },
}))

import { PUT } from './route'

const callPut = (body: object) => PUT(
  new NextRequest('http://localhost/api/elevage/animaux/7', { method: 'PUT', body: JSON.stringify(body) }),
  { params: Promise.resolve({ id: '7' }) }
)

describe('affectation d’un lot via PUT /api/elevage/animaux/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.animalFindFirst.mockResolvedValue({ id: 7, especeAnimaleId: 'ovin' })
    mocks.animalUpdate.mockResolvedValue({ id: 7, prixAchat: null })
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
