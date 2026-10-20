/**
 * Ticket QA cmv3japsf : « Noter » du conseiller d'irrigation avec la quantité
 * versée. Corps rejoués tels que `noterArrosage` / `annulerArrosage` les envoient.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  enregistrerArrosageCultures: vi.fn(),
  enregistrerArrosageMesure: vi.fn(),
  annulerArrosageCultures: vi.fn(),
  annulerArrosageMesure: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/irrigation-conseil', () => ({ computeConseilIrrigation: vi.fn() }))
vi.mock('@/lib/irrigation-recording', () => ({
  enregistrerArrosageCultures: mocks.enregistrerArrosageCultures,
  enregistrerArrosageMesure: mocks.enregistrerArrosageMesure,
  annulerArrosageCultures: mocks.annulerArrosageCultures,
  annulerArrosageMesure: mocks.annulerArrosageMesure,
  supprimerArrosageNote: vi.fn(),
}))

import { computeConseilIrrigation } from '@/lib/irrigation-conseil'
import { GET, PATCH } from './route'

const patch = (body: object) =>
  new NextRequest('http://localhost/api/cultures/irriguer', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

describe('PATCH /api/cultures/irriguer : quantité versée', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  })

  it('avec des litres : intervention mesurée, pas de remise à plein', async () => {
    mocks.enregistrerArrosageMesure.mockResolvedValue({ ok: true, interventionId: 501, cultureIds: [7, 8], plancheId: 'c3' })
    const res = await PATCH(patch({ cultureIds: [7, 8], marquerArrosage: true, notes: null, litres: 193 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, interventionId: 501 })
    expect(mocks.enregistrerArrosageMesure).toHaveBeenCalledWith({
      userId: 'u1',
      cultureIds: [7, 8],
      litres: 193,
      notes: null,
    })
    expect(mocks.enregistrerArrosageCultures).not.toHaveBeenCalled()
  })

  // Ticket QA du 2026-10-19 : « Marquer comme arrosé » de la page Irriguer
  // passe par le même dialogue et le même client ; corps d'un apport partiel.
  it('page Irriguer : une culture, apport partiel, observation transmise', async () => {
    mocks.enregistrerArrosageMesure.mockResolvedValue({ ok: true, interventionId: 502, cultureIds: [42], plancheId: 'a3' })
    const res = await PATCH(patch({ cultureIds: [42], marquerArrosage: true, notes: 'Apport partiel', litres: 200 }))
    expect(res.status).toBe(200)
    expect(mocks.enregistrerArrosageMesure).toHaveBeenCalledWith({
      userId: 'u1',
      cultureIds: [42],
      litres: 200,
      notes: 'Apport partiel',
    })
    expect(mocks.enregistrerArrosageCultures).not.toHaveBeenCalled()
  })

  it('« Quantité inconnue » (sans litres) : arrosage complet, comme avant', async () => {
    mocks.enregistrerArrosageCultures.mockResolvedValue({ dateEffective: new Date(), derniereIrrigationAvant: {} })
    const res = await PATCH(patch({ cultureIds: [7, 8], marquerArrosage: true, notes: null }))
    expect(res.status).toBe(200)
    expect(mocks.enregistrerArrosageCultures).toHaveBeenCalled()
    expect(mocks.enregistrerArrosageMesure).not.toHaveBeenCalled()
  })

  it('une quantité refusée renvoie son motif', async () => {
    mocks.enregistrerArrosageMesure.mockResolvedValue({ ok: false, erreur: 'Une quantité se note planche par planche' })
    const res = await PATCH(patch({ cultureIds: [7, 9], marquerArrosage: true, litres: 50 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Une quantité se note planche par planche')
  })

  it('« Annuler » supprime l’intervention créée', async () => {
    mocks.annulerArrosageMesure.mockResolvedValue({ interventionsSupprimees: 1 })
    const res = await PATCH(patch({ annulerArrosage: true, interventionId: 501 }))
    expect(res.status).toBe(200)
    expect(mocks.annulerArrosageMesure).toHaveBeenCalledWith({ userId: 'u1', interventionId: 501 })
    expect(mocks.annulerArrosageCultures).not.toHaveBeenCalled()
  })
})

/**
 * QA cmvge3o5z — « À arroser aujourd'hui » de la page Irriguer lit la même
 * tournée que la page Tâches (cultures cochées), et nomme l'urgence écartée.
 */
describe('GET /api/cultures/irriguer : tournée du jour', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  })

  it('compte la tournée des tâches et nomme le poireau non coché', async () => {
    const base = { raisonUrgence: 'Déficit', sousAbri: false, reserve: null }
    vi.mocked(computeConseilIrrigation).mockResolvedValue({
      data: [
        { ...base, id: 985, aIrriguer: true, urgence: 'haute', espece: { nom: 'Radis' }, planche: null },
        { ...base, id: 827, aIrriguer: true, urgence: 'haute', espece: { nom: 'Potimarron' }, planche: { id: 'c1', nom: 'C1', ilot: 'C' } },
        {
          ...base,
          id: 829,
          aIrriguer: null,
          urgence: 'critique',
          espece: { nom: 'Poireau' },
          variete: { id: 'Poireau Bleu de Solaise', nom: null },
          planche: { id: 'c2', nom: 'C2', ilot: 'C' },
        },
      ],
      stats: { critique: 1, haute: 2 },
    } as never)

    const res = await GET(new NextRequest('http://localhost/api/cultures/irriguer'))

    expect(res.status).toBe(200)
    const corps = await res.json()
    // Le conseil garde ses urgences (information) ...
    expect(corps.stats).toEqual({ critique: 1, haute: 2 })
    // ... mais « à arroser aujourd'hui » est la tournée de la page Tâches.
    expect(corps.tournee.lignes).toHaveLength(2)
    expect(corps.tournee.nbCultures).toBe(2)
    expect(corps.tournee.horsTournee).toEqual([
      { cultureId: 829, libelle: 'Poireau Bleu de Solaise', plancheNom: 'C2', urgence: 'critique', motif: 'non_cochee' },
    ])
  })
})
