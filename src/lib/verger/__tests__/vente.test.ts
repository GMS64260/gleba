import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Revue du 2026-10-29 : pour corriger le montant d'une vente directe déclarée
 * payée, la garde se contentait d'un dossier de règlement, même vide, alors
 * que celle des dépenses exige des versements actifs. Un dossier dont tous
 * les versements sont annulés ne prouve plus le paiement historique.
 */

const mocks = vi.hoisted(() => ({
  lot: null as Record<string, unknown> | null,
  historique: null as Record<string, unknown> | null,
  dossier: null as { dossierId: string; regle: number; actifs: number } | null,
  mouvements: [] as Array<Record<string, unknown>>,
  update: vi.fn(),
}))

vi.mock('@/lib/stocks/verrou-commercial', () => ({ verrouillerStockCommercial: vi.fn() }))
vi.mock('@/lib/kpi/cache', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createVenteFromRecolteArbre: vi.fn(), createVenteFromProductionBois: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/facture-utils', () => ({ annulerFactureLiee: vi.fn(), creerFacture: vi.fn() }))
vi.mock('@/lib/comptabilite/reglements', () => ({ ajouterReglementTx: vi.fn() }))
vi.mock('@/lib/comptabilite/suivi-reglement-source', () => ({
  suiviReglementParCle: vi.fn(async () => mocks.dossier),
  suiviReglementActif: vi.fn(async () => (mocks.dossier?.actifs ? mocks.dossier : null)),
}))
vi.mock('@/lib/verger/dar', () => ({ avertissementsDarFruit: vi.fn(async () => []) }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    recolteArbre: { findUnique: vi.fn(async () => mocks.lot), update: mocks.update },
    productionBois: { findUnique: vi.fn(async () => null) },
    venteManuelle: { findFirst: vi.fn(async () => mocks.historique) },
    mouvementStockCommercial: { findMany: vi.fn(async () => mocks.mouvements) },
  }
  return { default: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }
})

import { modifierVenteVerger } from '../vente'

const SUITE = new Error('garde franchie')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lot = {
    id: 3, userId: 'u1', arbreId: 1, parcelleId: null, quantite: 10, statut: 'vendu', factureId: null, stockDisponibleCommercial: null,
    date: new Date('2026-10-01T12:00:00Z'), dateVente: new Date('2026-10-02T12:00:00Z'), clientId: null, clientNom: null,
    datePeremption: null, arbre: { nom: 'Pommier', espece: 'Pommier' },
  }
  mocks.historique = { paye: true, modeReglement: 'Espèces', montant: 40 }
  mocks.dossier = null
  mocks.mouvements = []
  mocks.update.mockRejectedValue(SUITE)
})

describe('correction du montant d’une vente directe déclarée payée', () => {
  const corriger = () => modifierVenteVerger('fruit', 'u1', 'u1', 3, { prixTotal: 50 })

  it('refuse sans dossier de règlement', async () => {
    await expect(corriger()).rejects.toMatchObject({ status: 409, message: expect.stringContaining('versements historiques') })
  })

  it('refuse un dossier dont aucun versement n’est actif', async () => {
    mocks.dossier = { dossierId: 'dossier-1', regle: 0, actifs: 0 }
    await expect(corriger()).rejects.toMatchObject({ status: 409, message: expect.stringContaining('versements historiques') })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('laisse corriger quand des versements actifs détaillent le paiement', async () => {
    mocks.dossier = { dossierId: 'dossier-1', regle: 4000, actifs: 1 }
    await expect(corriger()).rejects.toBe(SUITE)
  })
})

describe('vente directe d’un lot entamé par une perte', () => {
  it('oriente vers un BL ou l’annulation des sorties, sans parler de document commercial', async () => {
    mocks.lot = { ...mocks.lot!, statut: 'en_stock', stockDisponibleCommercial: 8 }
    mocks.mouvements = [{ id: 'perte-1', nature: 'perte', quantite: 2, unite: 'kg', date: new Date('2026-10-02T12:00:00Z') }]
    const vente = modifierVenteVerger('fruit', 'u1', 'u1', 3, { statut: 'vendu', prixTotal: 30 })
    await expect(vente).rejects.toMatchObject({ status: 409, message: expect.stringContaining('annulez ces sorties') })
  })
})
