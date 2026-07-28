import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  naissanceFindFirst: vi.fn(),
  petitFindFirst: vi.fn(),
  reservationFindFirst: vi.fn(),
  reservationCreate: vi.fn(),
  reservationUpdate: vi.fn(),
  autoSync: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: (() => {
    const tx = {
    naissanceAnimale: { findFirst: mocks.naissanceFindFirst },
    petitNaissance: { findFirst: mocks.petitFindFirst },
    reservationElevage: {
      findFirst: mocks.reservationFindFirst,
      findMany: vi.fn(),
      create: mocks.reservationCreate,
      update: mocks.reservationUpdate,
      delete: vi.fn(),
    },
      venteManuelle: { deleteMany: vi.fn() },
    }
    return { ...tx, $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) }
  })(),
}))
vi.mock('@/lib/auto-compta', () => ({ upsertVenteFromReservationElevage: mocks.autoSync }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))

import { PATCH, POST } from './route'

const request = (method: string, body: object) => new NextRequest(
  'http://localhost/api/elevage/reservations',
  {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }
)

const porteeCompagnie = {
  userId: 'user-1',
  mere: { especeAnimale: { filiere: 'compagnie' } },
  lot: null,
}

describe('intégrité des références de réservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.reservationCreate.mockImplementation(async ({ data }) => ({ id: 'r1', ...data }))
    mocks.reservationUpdate.mockImplementation(async ({ data }) => ({ id: 'r1', ...data }))
    mocks.reservationFindFirst.mockResolvedValue({
      id: 'r1',
      naissanceId: 10,
      petitNaissanceId: 'petit-1',
      acompte: null,
      montant: null,
    })
  })

  it("refuse un petit qui n'appartient pas à l'utilisateur", async () => {
    mocks.petitFindFirst.mockResolvedValue(null)

    const response = await POST(request('POST', {
      acquereurNom: 'Alice',
      petitNaissanceId: 'petit-autre-tenant',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Petit introuvable' })
    expect(mocks.reservationCreate).not.toHaveBeenCalled()
  })

  it("refuse un petit qui n'appartient pas à la portée sélectionnée", async () => {
    mocks.petitFindFirst.mockResolvedValue({
      naissanceId: 10,
      naissance: porteeCompagnie,
    })

    const response = await POST(request('POST', {
      acquereurNom: 'Alice',
      naissanceId: 11,
      petitNaissanceId: 'petit-1',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Le petit n'appartient pas à la portée sélectionnée",
    })
    expect(mocks.reservationCreate).not.toHaveBeenCalled()
  })

  it('déduit la portée du petit après validation du tenant et de la filière', async () => {
    mocks.petitFindFirst.mockResolvedValue({
      naissanceId: 10,
      naissance: porteeCompagnie,
    })

    const response = await POST(request('POST', {
      acquereurNom: 'Alice',
      petitNaissanceId: 'petit-1',
      acompte: 100,
    }))

    expect(response.status).toBe(201)
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        naissanceId: 10,
        petitNaissanceId: 'petit-1',
        acompte: 100,
      }),
    })
  })

  it('PATCH revalide la nouvelle portée et détache le petit précédent', async () => {
    mocks.naissanceFindFirst.mockResolvedValue(porteeCompagnie)

    const response = await PATCH(request('PATCH', {
      id: 'r1',
      naissanceId: 12,
    }))

    expect(response.status).toBe(200)
    expect(mocks.naissanceFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 12, userId: 'user-1' },
    }))
    expect(mocks.reservationUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        naissanceId: 12,
        petitNaissanceId: null,
      },
    })
  })

  it('refuse une portée équine ou NAC sur le parcours de cession compagnie', async () => {
    mocks.naissanceFindFirst.mockResolvedValue({
      userId: 'user-1',
      mere: { especeAnimale: { filiere: 'equin' } },
      lot: null,
    })

    const response = await PATCH(request('PATCH', {
      id: 'r1',
      naissanceId: 12,
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Portée introuvable' })
    expect(mocks.reservationUpdate).not.toHaveBeenCalled()
  })
})
