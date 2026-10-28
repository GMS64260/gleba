import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  venteDeleteMany: vi.fn(),
  venteCreate: vi.fn(),
  venteFindFirst: vi.fn(),
  depenseDeleteMany: vi.fn(),
  depenseCreate: vi.fn(),
  depenseFindFirst: vi.fn(),
  alimentFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
    venteManuelle: {
      deleteMany: mocks.venteDeleteMany,
      create: mocks.venteCreate,
      findFirst: mocks.venteFindFirst,
    },
    depenseManuelle: {
      deleteMany: mocks.depenseDeleteMany,
      create: mocks.depenseCreate,
      findFirst: mocks.depenseFindFirst,
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
  createDepenseFromLotAnimaux,
  createDepenseFromConsommationAliment,
  createVenteFromProductionBois,
  createVenteFromRecolte,
  createVenteFromRecolteArbre,
  createVenteFromVenteProduit,
  upsertVenteFromReservationElevage,
} from '@/lib/auto-compta'

describe('invariants auto-compta élevage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.venteCreate.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
    mocks.venteFindFirst.mockResolvedValue(null)
    mocks.depenseFindFirst.mockResolvedValue(null)
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

  it.each([undefined, null])('ne déduit aucun encaissement d’un statut absent (%s)', async (paye) => {
    await createVenteFromVenteProduit('user-1', {
      id: 10, type: 'animal_vivant', prixTotal: 100, paye,
    })
    expect(mocks.venteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ paye: false }),
    })
  })

  it('classe une vente de miel dans les produits de la ruche avec son taux réel', async () => {
    await createVenteFromVenteProduit('user-1', {
      id: 11,
      type: 'miel',
      description: 'Miel de printemps',
      prixTotal: 105.5,
      tauxTVA: 5.5,
      paye: true,
    })

    expect(mocks.venteCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categorie: 'produits_ruche',
        tauxTVA: 5.5,
        montantHT: 100,
        montantTVA: 5.5,
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
      $executeRaw: async () => 0,
      venteManuelle: {
        deleteMany: mocks.venteDeleteMany,
        create: mocks.venteCreate,
        findFirst: mocks.venteFindFirst,
      },
    } as unknown as Parameters<typeof upsertVenteFromReservationElevage>[0]

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

  // Ticket cmvgdzsf7 (2026-10-20) — le miroir est supprimé puis recréé à chaque
  // modification de la source : la pièce saisie dans Transactions (règlement,
  // numéro de pièce, notes) doit survivre à la régénération.
  it('reporte le suivi saisi sur l’ancien miroir, pas le statut payé', async () => {
    mocks.venteFindFirst.mockResolvedValue({
      modeReglement: 'Chèque',
      numeroPiece: 'CHQ-0042',
      journal: 'VE',
      pjUrl: null,
      notes: 'Remis en banque le 21/10',
    })

    await createVenteFromVenteProduit('user-1', {
      id: 167,
      type: 'oeufs',
      prixTotal: 86.4,
      tauxTVA: 5.5,
      paye: false,
    })

    // L'ancien miroir est lu avec la même portée que celle qu'on supprime.
    expect(mocks.venteFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', sourceType: 'vente_produit', sourceId: 167, auto: true },
      select: { modeReglement: true, numeroPiece: true, journal: true, pjUrl: true, notes: true },
    })
    const data = mocks.venteCreate.mock.calls[0][0].data
    expect(data).toMatchObject({
      modeReglement: 'Chèque',
      numeroPiece: 'CHQ-0042',
      journal: 'VE',
      notes: 'Remis en banque le 21/10',
      // `paye` reste celui de la source.
      paye: false,
      montant: 86.4,
    })
    expect(data).not.toHaveProperty('pjUrl')
  })

  it('reporte le suivi de chaque ligne d’une réservation sur la ligne de même référence', async () => {
    mocks.venteFindFirst.mockImplementation(async ({ where }) =>
      where.sourceRef === 'reservation-1:acompte' ? { numeroPiece: 'VIR-7', notes: null } : null,
    )
    const tx = {
      $executeRaw: async () => 0,
      venteManuelle: {
        deleteMany: mocks.venteDeleteMany,
        create: mocks.venteCreate,
        findFirst: mocks.venteFindFirst,
      },
    } as unknown as Parameters<typeof upsertVenteFromReservationElevage>[0]

    await upsertVenteFromReservationElevage(tx, 'user-1', {
      id: 'reservation-1',
      statut: 'livree',
      acompte: 300,
      montant: 1400,
      dateReservation: new Date('2026-07-01'),
      dateLivraison: new Date('2026-08-01'),
    })

    const rows = mocks.venteCreate.mock.calls.map((call) => call[0].data)
    expect(rows.map((row) => row.numeroPiece)).toEqual(['VIR-7', undefined])
  })

  // Revue du 2026-10-20 : la lecture du suivi et la suppression de l'ancien
  // miroir sont scopées au compte, pour chaque source (pas seulement l'élevage).
  it.each([
    ['recolte', () => createVenteFromRecolte('user-1', { id: 1177, especeId: 'Dahlia', quantite: 40, unite: 'tige', prixKg: 1.2, prixTotal: 48 })],
    ['recolte_arbre', () => createVenteFromRecolteArbre('user-1', { id: 51, quantite: 10, prixKg: 3, prixTotal: 30 })],
    ['production_bois', () => createVenteFromProductionBois('user-1', { id: 34, type: 'elagage', volumeM3: 3, prixVente: 450 })],
  ])('reprend le suivi du miroir %s dans le seul compte de la source', async (sourceType, regenerer) => {
    mocks.venteFindFirst.mockResolvedValue({ numeroPiece: 'PC-7', modeReglement: 'Virement', notes: null })

    await regenerer()

    const sourceId = { recolte: 1177, recolte_arbre: 51, production_bois: 34 }[sourceType as string]
    const where = { userId: 'user-1', sourceType, sourceId, auto: true }
    expect(mocks.venteFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where }))
    expect(mocks.venteDeleteMany).toHaveBeenCalledWith({ where })
    expect(mocks.venteCreate.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      sourceType,
      numeroPiece: 'PC-7',
      modeReglement: 'Virement',
    })
  })

  // QA cmvnp0dm9 (2026-10-25) — vente de bois sans facture : l'écriture
  // portait « Vente bois - elagage - … - 0.2 m³ ».
  it('décrit la vente de bois par le libellé du type, comme l’écran et la facture', async () => {
    await createVenteFromProductionBois('user-1', {
      id: 41,
      type: 'elagage',
      volumeM3: 0.2,
      prixVente: 24,
      arbre: { nom: 'Noyer 2', espece: 'Noyer' },
    })

    expect(mocks.venteCreate.mock.calls[0][0].data).toMatchObject({
      description: 'Vente bois - Élagage - Noyer 2 - 0,2 m³',
      quantite: 0.2,
      unite: 'm³',
    })
  })
})


describe('suivi des achats d’élevage', () => {
  it('conserve l’impayé, la pièce et l’échéance lors d’une correction de lot', async () => {
    vi.clearAllMocks()
    const suivi = { paye: false, modeReglement: 'Virement', numeroPiece: 'ACH-QA', journal: 'AC', pjUrl: null, notes: 'Pointage à vérifier', refFacture: 'FA-QA', dateEcheance: new Date('2026-11-01') }
    mocks.depenseFindFirst.mockResolvedValue(suivi)
    await createDepenseFromLotAnimaux('user-1', { id: 71, nom: 'Poules QA', prixAchatTotal: 211 })
    expect(mocks.depenseFindFirst.mock.calls[0][0].where).toEqual({ userId: 'user-1', auto: true, sourceType: 'achat_animal', sourceId: 71 })
    expect(mocks.depenseCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ ...suivi, montant: 211, montantHT: 200, montantTVA: 11 }) })
  })
  it('permet de saisir le mode sur une vente sans changer son statut impayé', async () => {
    mocks.venteFindFirst.mockResolvedValue(null)
    await createVenteFromVenteProduit('user-1', { id: 22, type: 'oeufs', prixTotal: 12, paye: false, modeReglement: 'Chèque' })
    expect(mocks.venteCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ modeReglement: 'Chèque', paye: false }) })
  })
})
