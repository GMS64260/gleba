import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  isAssignableAnimalLot: vi.fn(),
  especeFindUnique: vi.fn(),
  especeFindFirst: vi.fn(),
  raceFindFirst: vi.fn(),
  animalFindFirst: vi.fn(),
  animalFindMany: vi.fn(),
  animalCreate: vi.fn(),
  animalUpdate: vi.fn(),
  enregistrerChangementLot: vi.fn(),
  exploitationFindUnique: vi.fn(),
  lotAnimauxFindFirst: vi.fn(),
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
    exploitation: { findUnique: mocks.exploitationFindUnique },
    animal: {
      findFirst: mocks.animalFindFirst,
      findMany: mocks.animalFindMany,
      create: mocks.animalCreate,
      update: mocks.animalUpdate,
    },
    lotAnimaux: { findFirst: mocks.lotAnimauxFindFirst },
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
    mocks.animalCreate.mockResolvedValue({ id: 7, lotId: 42, prixAchat: null, createdAt: new Date(), dateArrivee: new Date(), statutSanitaire: [] })
    mocks.animalUpdate.mockImplementation(async ({ data }) => ({ id: 7, lotId: data.lotId ?? 42, prixAchat: null }))
    mocks.exploitationFindUnique.mockResolvedValue({ numeroEde: "EDE-TEST" })
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

  // QA cmsw8xwgi (2026-08-16) — prix individuel + lot déjà porteur d'un prix :
  // la création était refusée en 400 derrière une case invisible du
  // formulaire et la fiche saisie était perdue. À la création, la ventilation
  // informative est désormais forcée (prix marqué inclus dans le lot, donc
  // jamais compté deux fois) au lieu de rejeter.
  it('POST force « prix inclus dans le lot » quand le lot porte déjà un prix d’achat', async () => {
    mocks.isAssignableAnimalLot.mockResolvedValue(true)
    mocks.lotAnimauxFindFirst.mockResolvedValue({ prixAchatTotal: 50 })

    const response = await POST(request('POST', {
      especeAnimaleId: 'ovin',
      lotId: 42,
      prixAchat: 25,
    }))

    expect(response.status).toBe(201)
    expect(mocks.animalCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ prixAchat: 25, prixAchatInclusDansLot: true }),
    }))
  })

  it('POST conserve un prix individuel hors lot sans le marquer inclus', async () => {
    mocks.isAssignableAnimalLot.mockResolvedValue(true)
    mocks.lotAnimauxFindFirst.mockResolvedValue({ prixAchatTotal: null })

    const response = await POST(request('POST', {
      especeAnimaleId: 'ovin',
      lotId: 42,
      prixAchat: 25,
    }))

    expect(response.status).toBe(201)
    expect(mocks.animalCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ prixAchat: 25, prixAchatInclusDansLot: false }),
    }))
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

// Ticket cmsoevxrj — durcissement généalogie : en complément de la garde
// anti-cycle, un parent né APRÈS l'enfant est refusé en 400 avec un message
// clair, uniquement quand les deux dates de naissance sont connues.
describe('vraisemblance des dates de filiation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.especeFindUnique.mockResolvedValue({ id: 'ovin' })
    mocks.isAssignableAnimalLot.mockResolvedValue(true)
    mocks.animalFindMany.mockResolvedValue([]) // pas d'ascendance → pas de cycle
    mocks.animalCreate.mockResolvedValue({ id: 8, lotId: null, prixAchat: null, createdAt: new Date(), dateArrivee: new Date(), statutSanitaire: [] })
    mocks.animalUpdate.mockResolvedValue({ id: 7, lotId: null, prixAchat: null })
    mocks.exploitationFindUnique.mockResolvedValue({ numeroEde: 'EDE-TEST' })
  })

  it('PATCH refuse un père né après l’animal', async () => {
    mocks.animalFindFirst
      .mockResolvedValueOnce({ id: 7, especeAnimaleId: 'ovin', lotId: null, dateNaissance: new Date('2024-03-01') }) // existing
      .mockResolvedValueOnce({ id: 9, dateNaissance: new Date('2025-01-10') }) // père proposé

    const response = await PATCH(request('PATCH', { id: 7, pereId: 9 }))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe(
      'Filiation impossible : le père proposé est né le 10/01/2025, après la naissance de cet animal (01/03/2024)',
    )
    expect(mocks.animalUpdate).not.toHaveBeenCalled()
  })

  it('PATCH évalue la vraisemblance avec la dateNaissance envoyée dans le même PATCH', async () => {
    // En base l'enfant est né avant le parent, mais le PATCH corrige sa date
    // de naissance : c'est la date CIBLE qui compte.
    mocks.animalFindFirst
      .mockResolvedValueOnce({ id: 7, especeAnimaleId: 'ovin', lotId: null, dateNaissance: new Date('2023-01-01') })
      .mockResolvedValueOnce({ id: 9, dateNaissance: new Date('2024-06-01') })

    const response = await PATCH(request('PATCH', { id: 7, pereId: 9, dateNaissance: '2024-05-01' }))

    expect(response.status).toBe(400)
    expect(mocks.animalUpdate).not.toHaveBeenCalled()
  })

  it('PATCH accepte un parent né avant l’animal', async () => {
    mocks.animalFindFirst
      .mockResolvedValueOnce({ id: 7, especeAnimaleId: 'ovin', lotId: null, dateNaissance: new Date('2024-03-01') })
      .mockResolvedValueOnce({ id: 9, dateNaissance: new Date('2022-02-15') })

    const response = await PATCH(request('PATCH', { id: 7, pereId: 9 }))

    expect(response.status).toBe(200)
    expect(mocks.animalUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pereId: 9 }),
    }))
  })

  it('PATCH ne bloque pas quand une des deux dates est inconnue', async () => {
    mocks.animalFindFirst
      .mockResolvedValueOnce({ id: 7, especeAnimaleId: 'ovin', lotId: null, dateNaissance: null })
      .mockResolvedValueOnce({ id: 9, dateNaissance: new Date('2025-01-10') })

    const response = await PATCH(request('PATCH', { id: 7, pereId: 9 }))

    expect(response.status).toBe(200)
    expect(mocks.animalUpdate).toHaveBeenCalled()
  })

  it('POST refuse une mère née après le nouvel animal', async () => {
    mocks.animalFindFirst.mockResolvedValueOnce({ id: 5, dateNaissance: new Date('2025-01-10') }) // mère proposée

    const response = await POST(request('POST', { especeAnimaleId: 'ovin', mereId: 5, dateNaissance: '2024-03-01' }))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe(
      'Filiation impossible : la mère proposée est née le 10/01/2025, après la naissance de cet animal (01/03/2024)',
    )
    expect(mocks.animalCreate).not.toHaveBeenCalled()
  })
})
