import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  venteDeleteMany: vi.fn(),
  venteCreate: vi.fn(),
  depenseDeleteMany: vi.fn(),
  depenseCreate: vi.fn(),
  alimentFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    venteManuelle: {
      deleteMany: mocks.venteDeleteMany,
      create: mocks.venteCreate,
    },
    depenseManuelle: {
      deleteMany: mocks.depenseDeleteMany,
      create: mocks.depenseCreate,
    },
    aliment: { findUnique: mocks.alimentFindUnique },
  }
  return {
    default: {
      ...tx,
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    },
  }
})

import {
  createDepenseFromAchatAnimal,
  createDepenseFromConsommationAliment,
  createVenteFromVenteProduit,
  upsertVenteFromReservationElevage,
} from '@/lib/auto-compta'

describe('invariants auto-compta élevage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.venteCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    mocks.depenseCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    mocks.alimentFindUnique.mockResolvedValue({
      nom: 'Foin',
      prix: 0.2,
      userStocks: [{ prix: 0.25, coutUnitaire: 0.3 }],
    })
  })

  it('conserve le statut impayé de la vente source', async () => {
    await createVenteFromVenteProduit('user-1', {
      id: 10,
      type: 'oeufs',
      prixTotal: 105.5,
      tauxTVA: 5.5,
      paye: false,
    })

    expect(mocks.venteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        sourceType: 'vente_produit',
        sourceId: 10,
        paye: false,
      }),
    })
  })

  it("ne crée pas une seconde dépense si le prix individuel est inclus dans le lot", async () => {
    await createDepenseFromAchatAnimal('user-1', {
      id: 20,
      prixAchat: 400,
      prixAchatInclusDansLot: true,
    })

    expect(mocks.depenseDeleteMany).toHaveBeenCalled()
    expect(mocks.depenseCreate).not.toHaveBeenCalled()
  })

  it("classe la consommation d'aliment comme coût analytique non déductible", async () => {
    await createDepenseFromConsommationAliment('user-1', {
      id: 30,
      alimentId: 'foin',
      quantite: 10,
    })

    expect(mocks.depenseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        montant: 3,
        comptable: false,
        tvaInferee: true,
        sourceType: 'consommation_aliment',
      }),
    })
  })

  it('ventile une cession livrée entre acompte payé et solde impayé sans double compte', async () => {
    const tx = {
      venteManuelle: {
        deleteMany: mocks.venteDeleteMany,
        create: mocks.venteCreate,
      },
    } as Parameters<typeof upsertVenteFromReservationElevage>[0]

    await upsertVenteFromReservationElevage(tx, 'user-1', {
      id: 'reservation-1',
      statut: 'livree',
      acompte: 300,
      montant: 1400,
      dateReservation: new Date('2026-07-01'),
      dateLivraison: new Date('2026-08-01'),
      acquereurNom: 'Client',
    })

    const rows = mocks.venteCreate.mock.calls.map((call) => call[0].data)
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.montant)).toEqual([300, 1100])
    expect(rows.map((row) => row.paye)).toEqual([true, false])
    expect(rows.reduce((sum, row) => sum + row.montant, 0)).toBe(1400)
  })
})
