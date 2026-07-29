import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  zoneEffectiveUser: vi.fn(),
  statsAvisPourRefs: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    iTP: {
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}))
vi.mock('@/lib/terroir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terroir')>()
  return { ...actual, zoneEffectiveUser: mocks.zoneEffectiveUser }
})
vi.mock('@/lib/avis/stats-liste', () => ({ statsAvisPourRefs: mocks.statsAvisPourRefs }))

import { GET } from './route'

describe('GET /api/itps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'USER' } },
    })
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(0)
    mocks.zoneEffectiveUser.mockResolvedValue('oceanique')
  })

  it('borne la pagination, masque les scénarios inactifs et recherche dans la provenance', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/itps?page=0&pageSize=5000&search=INRAE')
    )

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 1000,
        where: {
          AND: [
            expect.objectContaining({
              actif: true,
              OR: expect.arrayContaining([
                { nom: { contains: 'INRAE', mode: 'insensitive' } },
                { sourceReference: { contains: 'INRAE', mode: 'insensitive' } },
              ]),
            }),
            expect.any(Object),
          ],
        },
      })
    )
  })

  it('retient les références génériques et régionales en métropole', async () => {
    await GET(new NextRequest('http://localhost/api/itps?applicable=1'))

    const args = mocks.findMany.mock.calls[0][0]
    const catalogueFilter = args.where.AND[0]
    expect(catalogueFilter.AND).toEqual([
      {
        OR: [
          { zoneClimat: null },
          {
            zoneClimat: {
              in: [
                'mediterraneen',
                'oceanique',
                'oceanique_altere',
                'semi_continental',
                'montagnard',
              ],
            },
          },
        ],
      },
    ])
  })

  it('retient seulement la zone tropicale exacte outre-mer', async () => {
    mocks.zoneEffectiveUser.mockResolvedValue('tropical_antilles')

    await GET(new NextRequest('http://localhost/api/itps?applicable=1'))

    const args = mocks.findMany.mock.calls[0][0]
    expect(args.where.AND[0].zoneClimat).toBe('tropical_antilles')
  })

  it("calibre chaque scénario depuis son climat source vers celui de l'exploitation", async () => {
    mocks.zoneEffectiveUser.mockResolvedValue('semi_continental')
    mocks.findMany.mockResolvedValue([
      {
        id: 'inrae-1',
        zoneClimat: 'oceanique',
        semaineSemis: 16,
        semainePlantation: 20,
        semaineRecolte: 36,
        semaineImplantationDebut: 16,
        semaineImplantationFin: 18,
        semaineRecolteFin: 40,
      },
    ])
    mocks.count.mockResolvedValue(1)

    const response = await GET(
      new NextRequest('http://localhost/api/itps?applicable=1&calibre=1')
    )
    const body = await response.json()

    expect(body.data[0]).toMatchObject({
      semaineSemis: 18,
      semainePlantation: 22,
      semaineRecolte: 38,
      semaineImplantationDebut: 18,
      semaineImplantationFin: 20,
      semaineRecolteFin: 42,
      decalageClimatiqueApplique: 2,
      zoneClimatCible: 'semi_continental',
    })
  })
})
