import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  intervention: { findMany: vi.fn() },
  culture: { findMany: vi.fn() },
  irrigationPlanifiee: { findMany: vi.fn() },
  fertilisation: { findMany: vi.fn() },
  operationArbre: { findMany: vi.fn() },
  soinAnimal: { findMany: vi.fn() },
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({
  createDepenseFromIntervention: vi.fn(),
  deleteAutoEntry: vi.fn(),
}))

import { GET } from './route'

const planifiee = {
  id: 1,
  date: new Date('2026-11-14T12:00:00Z'),
  type: 'desherbage',
  cultureId: null,
  plancheId: null,
  arbreId: null,
  fait: false,
  dureeMinutes: 135,
  nbPersonnes: 3,
  coutTotal: 42,
}

async function lireStats() {
  const response = await GET(new NextRequest('http://localhost/api/interventions?annee=2026'))
  expect(response.status).toBe(200)
  return response.json()
}

describe('GET /api/interventions — heures et coût réalisés', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ session: { user: { id: 'ferme-test' } }, error: null })
    for (const source of [mocks.intervention, mocks.culture, mocks.irrigationPlanifiee,
      mocks.fertilisation, mocks.operationArbre, mocks.soinAnimal]) {
      source.findMany.mockResolvedValue([])
    }
  })

  it('compte 2 h 15 à trois personnes uniquement dans les heures planifiées', async () => {
    mocks.intervention.findMany.mockResolvedValue([planifiee])

    const { data, stats } = await lireStats()

    expect(stats).toEqual({
      total: 1, heuresTravaillees: 0, heuresPlanifiees: 6.75, coutTotal: 0, planifiees: 1,
    })
    expect(data).toHaveLength(1)
    expect(data[0].fait).toBe(false)
  })

  it('compte seulement les heures-personnes et le coût de la réalisée dans un registre mixte', async () => {
    mocks.intervention.findMany.mockResolvedValue([
      planifiee,
      { ...planifiee, id: 2, fait: true, dureeMinutes: 90, nbPersonnes: 2, coutTotal: 12 },
    ])

    const { stats } = await lireStats()

    expect(stats).toEqual({
      total: 2, heuresTravaillees: 3, heuresPlanifiees: 6.75, coutTotal: 12, planifiees: 1,
    })
  })

  it('exclut aussi les coûts planifiés des opérations d’arbre et soins fusionnés', async () => {
    mocks.operationArbre.findMany.mockResolvedValue([
      { id: 3, date: planifiee.date, type: 'taille', fait: false, cout: 30 },
      { id: 4, date: planifiee.date, type: 'taille', fait: true, cout: 5 },
    ])
    mocks.soinAnimal.findMany.mockResolvedValue([
      { id: 5, date: planifiee.date, type: 'autre', fait: false, cout: 40 },
      { id: 6, date: planifiee.date, type: 'autre', fait: true, cout: 7 },
    ])

    const { stats } = await lireStats()

    expect(stats).toEqual({
      total: 4, heuresTravaillees: 0, heuresPlanifiees: 0, coutTotal: 12, planifiees: 2,
    })
  })
})
