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

import { PATCH } from './route'

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
