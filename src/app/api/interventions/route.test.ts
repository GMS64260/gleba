/**
 * Ticket QA cmv3jatw8 : une intervention réalisée ne se date pas dans le futur.
 * Corps rejoués tels que la page Interventions les envoie.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/cache-helper', () => ({ getOrFetch: vi.fn() }))
vi.mock('@/lib/meteo', () => ({ fetchOpenMeteoHistory: vi.fn() }))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock('@/lib/irrigation-recording', () => ({ supprimerArrosageNote: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromIntervention: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/planches/resolution', () => ({ resoudreIdPlanche: vi.fn(async (_p: unknown, ref: string) => ref) }))
vi.mock('@/lib/prisma', () => ({
  default: { intervention: { create: mocks.create, findFirst: mocks.findFirst, update: mocks.update } },
}))

import { PATCH, POST } from './route'

const requete = (method: string, body: object) =>
  new NextRequest('http://localhost/api/interventions', {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

/** Corps de `handleCreate` (page Interventions) pour un arrosage. */
const corpsArrosage = (date: string, fait: boolean) => ({
  date,
  type: 'arrosage',
  cultureId: 461,
  plancheId: 'a3',
  description: '',
  dureeMinutes: 12,
  nbPersonnes: 1,
  coutMainOeuvre: null,
  coutTotal: null,
  fait,
  intrantNom: 'Eau',
  intrantQuantite: '96',
  intrantUnite: 'L',
  notes: '',
})

describe('intervention réalisée datée dans le futur (QA cmv3jatw8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-11T08:00:00Z'))
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
    mocks.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    mocks.update.mockImplementation(async ({ data }) => ({ id: 112, ...data }))
  })
  afterEach(() => vi.useRealTimers())

  it('POST : refuse une réalisée au-delà de demain, accepte aujourd’hui et une planifiée future', async () => {
    const futur = await POST(requete('POST', corpsArrosage('2026-10-14', true)))
    expect(futur.status).toBe(400)
    expect((await futur.json()).error).toMatch(/au plus tard aujourd'hui/)
    expect(mocks.create).not.toHaveBeenCalled()

    expect((await POST(requete('POST', corpsArrosage('2026-10-11', true)))).status).toBe(201)
    // Demain passe : marge de l'Outre-mer de l'Est (Nouméa est déjà le 12/10). L'écran, lui, le refuse.
    expect((await POST(requete('POST', corpsArrosage('2026-10-12', true)))).status).toBe(201)
    expect((await POST(requete('POST', corpsArrosage('2026-10-13', true)))).status).toBe(400)
    expect((await POST(requete('POST', corpsArrosage('2026-10-14', false)))).status).toBe(201)
  })

  it('PATCH : passer une planifiée future en réalisée est refusé, la dater du jour passe', async () => {
    mocks.findFirst.mockResolvedValue({ id: 112, userId: 'u1', fait: false, dureeMinutes: null, date: new Date('2026-10-14T00:00:00Z') })
    const refus = await PATCH(requete('PATCH', { id: 112, ...corpsArrosage('2026-10-14', true) }))
    expect(refus.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()

    // « Marquer fait » depuis le registre : date du jour.
    mocks.findFirst.mockResolvedValue({ id: 112, userId: 'u1', fait: false, dureeMinutes: 12, date: new Date('2026-10-14T00:00:00Z') })
    const ok = await PATCH(requete('PATCH', { id: 112, fait: true, date: new Date().toISOString() }))
    expect(ok.status).toBe(200)
  })
})
