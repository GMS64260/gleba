import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  isAssignableAnimalLot: vi.fn(),
  especeFindUnique: vi.fn(),
  especeFindFirst: vi.fn(),
  raceFindFirst: vi.fn(),
  animalFindFirst: vi.fn(),
  animalCreate: vi.fn(),
  animalUpdate: vi.fn(),
  enregistrerChangementLot: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/animal-lot', () => ({
  isAssignableAnimalLot: mocks.isAssignableAnimalLot,
  enregistrerChangementLot: mocks.enregistrerChangementLot,
}))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromAchatAnimal: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: (callback: (tx: unknown) => unknown) => callback({
      animal: { create: mocks.animalCreate, update: mocks.animalUpdate },
    }),
    especeAnimale: { findUnique: mocks.especeFindUnique, findFirst: mocks.especeFindFirst },
    raceAnimale: { findFirst: mocks.raceFindFirst },
    animal: {
      findFirst: mocks.animalFindFirst,
      create: mocks.animalCreate,
      update: mocks.animalUpdate,
    },
  },
}))

import { PATCH, POST } from './route'

const request = (method: string, body: object) => new NextRequest('http://localhost/api/elevage/animaux', {
  method,
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

describe('affectation d’un lot via /api/elevage/animaux', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.especeFindUnique.mockResolvedValue({ id: 'ovin' })
    mocks.especeFindFirst.mockResolvedValue({ id: 'brebis_solognote' })
    mocks.raceFindFirst.mockResolvedValue({ id: 'race-lacaune', nom: 'Lacaune' })
    mocks.animalFindFirst.mockResolvedValue({ id: 7, especeAnimaleId: 'ovin' })
    mocks.animalCreate.mockResolvedValue({ id: 7, lotId: 42, prixAchat: null, createdAt: new Date(), dateArrivee: new Date() })
    mocks.animalUpdate.mockImplementation(async ({ data }) => ({ id: 7, lotId: data.lotId ?? 42, prixAchat: null }))
  })

  it.each([
    ['POST', () => POST(request('POST', { especeAnimaleId: 'ovin', lotId: 42 }))],
    ['PATCH', () => PATCH(request('PATCH', { id: 7, lotId: 42 }))],
  ])('%s refuse avant écriture un lot non assignable avec une erreur non attribuable', async (_method, call) => {
    mocks.isAssignableAnimalLot.mockResolvedValue(false)

    const response = await call()

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Lot invalide' })
    expect(mocks.animalCreate).not.toHaveBeenCalled()
    expect(mocks.animalUpdate).not.toHaveBeenCalled()
  })

  it('POST accepte un lot assignable', async () => {
    mocks.isAssignableAnimalLot.mockResolvedValue(true)

    expect((await POST(request('POST', { especeAnimaleId: 'ovin', lotId: 42 }))).status).toBe(201)
    expect(mocks.animalCreate).toHaveBeenCalled()
  })

  it('PATCH accepte un lot assignable et permet le détachement', async () => {
    mocks.isAssignableAnimalLot.mockResolvedValue(true)
    await PATCH(request('PATCH', { id: 7, lotId: 42 }))
    expect(mocks.animalUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ lotId: 42 }) }))

    await PATCH(request('PATCH', { id: 7, lotId: null }))
    expect(mocks.animalUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ lotId: null }) }))
  })

  it('PATCH ne revalide pas un lot inchangé (animal déjà dans un lot devenu inactif)', async () => {
    // L'animal est déjà rattaché au lot 42 ; ce lot n'est plus assignable
    // (terminé). Rééditer l'animal sans changer de lot doit rester possible.
    mocks.animalFindFirst.mockResolvedValue({ id: 7, especeAnimaleId: 'ovin', lotId: 42 })
    mocks.isAssignableAnimalLot.mockResolvedValue(false)

    const response = await PATCH(request('PATCH', { id: 7, lotId: 42, poidsActuel: 55 }))

    expect(response.status).toBe(200)
    expect(mocks.isAssignableAnimalLot).not.toHaveBeenCalled()
    expect(mocks.animalUpdate).toHaveBeenCalled()
  })

  it('PATCH applique le nouveau type de brebis au lieu de l’ignorer', async () => {
    mocks.animalFindFirst.mockResolvedValue({ id: 7, especeAnimaleId: 'brebis_merinos_arles', lotId: null })

    const response = await PATCH(request('PATCH', { id: 7, especeAnimaleId: 'brebis_solognote' }))

    expect(response.status).toBe(200)
    expect(mocks.animalUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ especeAnimaleId: 'brebis_solognote' }),
    }))
  })

  it('persiste séparément orientation et race validée', async () => {
    const response = await PATCH(request('PATCH', { id: 7, orientationProduction: 'lait', raceAnimaleId: 'race-lacaune' }))
    expect(response.status).toBe(200)
    expect(mocks.raceFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ especeAnimaleId: 'ovin' }) }))
    expect(mocks.animalUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ orientationProduction: 'lait', raceAnimaleId: 'race-lacaune', race: 'Lacaune' }),
    }))
  })

  it('refuse une orientation inconnue avant écriture', async () => {
    const response = await PATCH(request('PATCH', { id: 7, orientationProduction: 'oeufs' }))
    expect(response.status).toBe(400)
    expect(mocks.animalUpdate).not.toHaveBeenCalled()
  })

  it('ne remappe ni n’efface une race historique quand le champ est omis', async () => {
    await PATCH(request('PATCH', { id: 7, orientationProduction: 'laine' }))
    const data = mocks.animalUpdate.mock.calls.at(-1)?.[0]?.data
    expect(data).not.toHaveProperty('raceAnimaleId')
    expect(data).not.toHaveProperty('race')
  })
})
