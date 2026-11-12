import { describe, expect, it, vi } from 'vitest'

/**
 * Revue réglementaire du 2026-11-12 (C5) : une récolte publiée en boutique
 * sort de la liste des lots du catalogue commercial ; son produit boutique ne
 * portait plus l'avertissement de délai avant récolte du lot d'origine, et un
 * BL ou une facture le proposait sans réserve.
 */

vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/verger/dar', () => ({ chargerAvertissementsDarFruits: vi.fn(async () => new Map()) }))
vi.mock('@/lib/recolte/dar', () => ({ chargerAvertissementsDarLegumes: vi.fn(async (_db: unknown, _u: string, lots: Array<{ id: number }>) => new Map(lots.map(l => [l.id, ['DAR : avertissement']]))) }))
vi.mock('@/lib/recolte/valorisation', () => ({ chargerPrixVentesMoyens: vi.fn(async () => new Map()), valoriserLot: vi.fn(() => null), prixProposeDeVente: vi.fn(() => null) }))
vi.mock('@/lib/elevage/stock-oeufs-lots', () => ({ computeStockOeufsParLots: vi.fn(async () => ({ data: [] })) }))
import { chargerCatalogueStock, type DbStockCommercial } from './catalogue-stock'

describe('délai avant récolte dans le catalogue commercial', () => {
  it('un produit de la boutique issu d’une récolte garde l’avertissement DAR de son lot', async () => {
    const produit = { id: 9, nom: 'Salade', actif: true, stockDispo: 4, unite: 'pièce', prix: 2, categorie: 'legumes', statutBio: null, recolteId: 5,
      recolte: { id: 5, cultureId: 10, date: new Date('2026-06-10'), datePeremption: null, culture: { plancheId: 'p1', planche: { parcelleGeoId: null } } } }
    const db = { ligneCommandeBoutique: { groupBy: async () => [] }, recolte: { findMany: async () => [] }, recolteArbre: { findMany: async () => [] },
      productionBois: { findMany: async () => [] }, produitBoutique: { findMany: async () => [produit] }, productionRuche: { findMany: async () => [] },
      lotFromage: { findMany: async () => [] }, lotTransforme: { findMany: async () => [] }, venteProduit: { findMany: async () => [] } } as unknown as DbStockCommercial
    const catalogue = await chargerCatalogueStock('u1', db, new Date('2026-06-11T10:00:00Z'))
    expect(catalogue.find(a => a.type === 'boutique')?.avertissements).toEqual(['DAR : avertissement'])
  })
})
