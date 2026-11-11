import { describe, expect, it, vi } from 'vitest'

/**
 * Revue du 2026-10-29 : depuis le 2026-10-28, un document contrôle ses
 * lignes de stock à midi UTC de son jour (`dateCivile`). Les lots du verger
 * étaient bornés à la fin du jour de Paris, mais les autres ateliers
 * comparaient leur horodatage brut à midi UTC : une récolte maraîchère ou une
 * ponte saisie l'après-midi (le tableau de bord, les tâches, l'accueil et
 * l'assistant enregistrent l'instant réel) disparaissait du BL du jour même.
 */

const oeufs = vi.hoisted(() => ({ lots: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/verger/dar', () => ({ chargerAvertissementsDarFruits: vi.fn(async () => new Map()) }))
vi.mock('@/lib/recolte/dar', () => ({ chargerAvertissementsDarLegumes: vi.fn(async () => new Map()) }))
vi.mock('@/lib/recolte/valorisation', () => ({
  chargerPrixVentesMoyens: vi.fn(async () => new Map()), valoriserLot: vi.fn(() => null), prixProposeDeVente: vi.fn(() => null),
}))
vi.mock('@/lib/elevage/stock-oeufs-lots', () => ({ computeStockOeufsParLots: vi.fn(async () => ({ data: oeufs.lots })) }))

import { chargerCatalogueStock, type DbStockCommercial } from './catalogue-stock'
import { dateCivile } from './regles'

type Ligne = { date?: Date; dateFabrication?: Date }
const jusqua = (champ: keyof Ligne, lignes: Ligne[]) => async ({ where }: { where: Record<string, { lte?: Date }> }) =>
  lignes.filter(l => !where[champ]?.lte || l[champ]! <= where[champ].lte!)

function base(recoltes: Ligne[], boutique: { produits?: unknown[]; reservees?: Array<{ produitId: number; _sum: { quantite: number } }> } = {}) {
  return {
    ligneCommandeBoutique: { groupBy: async () => boutique.reservees ?? [] },
    recolte: { findMany: jusqua('date', recoltes) },
    recolteArbre: { findMany: async () => [] },
    productionBois: { findMany: async () => [] },
    produitBoutique: { findMany: async () => boutique.produits ?? [] },
    productionRuche: { findMany: jusqua('date', []) },
    lotFromage: { findMany: jusqua('dateFabrication', []) },
    lotTransforme: { findMany: jusqua('date', []) },
    venteProduit: { findMany: async () => [] },
  } as unknown as DbStockCommercial
}

const recolte = (date: string) => ({ id: 1, especeId: 'tomate', espece: { id: 'tomate', nom: 'Tomate', prixKg: null, userId: null, uniteRendement: null },
  culture: { variete: null }, unite: 'kg', quantite: 5, stockDisponibleCommercial: null, datePeremption: null, prixKg: null,
  statutBioSnapshot: null, date: new Date(date) })

describe('catalogue d’un document daté du jour', () => {
  const jourDuBl = dateCivile('2026-10-28')

  it('propose une récolte maraîchère saisie l’après-midi du jour du BL', async () => {
    const catalogue = await chargerCatalogueStock('u1', base([recolte('2026-10-28T15:00:00Z')]), jourDuBl)
    expect(catalogue.map(a => `${a.type}:${a.id}`)).toContain('recolte:1')
  })

  it('exclut une récolte du lendemain à l’heure de Paris', async () => {
    const catalogue = await chargerCatalogueStock('u1', base([recolte('2026-10-28T23:30:00Z')]), jourDuBl)
    expect(catalogue.some(a => a.type === 'recolte')).toBe(false)
  })

  it('propose une ponte enregistrée l’après-midi du jour du BL', async () => {
    oeufs.lots = [{ id: 7, statut: 'commercialisable', datePonte: new Date('2026-10-28T16:00:00Z'), restant: 12 }]
    const catalogue = await chargerCatalogueStock('u1', base([]), jourDuBl)
    expect(catalogue.find(a => a.type === 'oeufs')?.disponible).toBe(12)
  })
})

describe('produits de la boutique dans un document commercial', () => {
  const produit = (id: number, stockDispo: number | null) => ({ id, nom: `Produit ${id}`, actif: true, stockDispo, unite: 'pièce', prix: 3, categorie: 'oeufs', statutBio: null, recolte: null })

  it('propose le stock net des commandes en cours de la boutique', async () => {
    const catalogue = await chargerCatalogueStock('u1', base([], {
      produits: [produit(1, 3), produit(2, 3), produit(3, null)],
      reservees: [{ produitId: 1, _sum: { quantite: 2 } }, { produitId: 2, _sum: { quantite: 3 } }],
    }))
    const boutique = catalogue.filter(a => a.type === 'boutique')
    // Produit 1 : 3 en rayon, 2 commandés → 1 ; produit 2 : tout est commandé, donc absent ; produit 3 : illimité.
    expect(boutique.map(a => [a.id, a.disponible])).toEqual([['1', 1], ['3', null]])
  })
})
