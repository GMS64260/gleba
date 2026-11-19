import type { Prisma, PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

// Catalogue public : pas de complément privé. Seule la lecture du disponible
// est remplacée ; l'adaptateur, les gardes documents et les entrées sont réels.
vi.mock('@/lib/commercial/catalogue-stock', () => ({
  chargerCatalogueStock: async () => [{ type: 'oeufs', id: 'stock', nom: 'Œufs', unite: 'pièce', disponible: 120, tauxTVA: 5.5 }],
}))
vi.mock('@/lib/commercial/stock', () => ({
  verrouillerStocksDesLignes: async () => {},
  sortirStockCommercial: async () => { throw new Error('Aucune sortie attendue') },
}))
import { motifBlocageRattachement } from '@/lib/commercial/engagements-rattachement'
import { relierProduitAuStock } from './stock-lie-disponible'
import { reprendreStockLieExploitation } from './reprise-stock-lie'

type Row = Record<string, unknown>
function correspond(row: unknown, filtre: unknown): boolean {
  if (filtre === null || typeof filtre !== 'object') return row === filtre
  return Object.entries(filtre as Row).every(([cle, valeur]) => {
    if (cle === 'OR') return (valeur as unknown[]).some(f => correspond(row, f))
    if (cle === 'in') return (valeur as unknown[]).includes(row)
    if (cle === 'is') return correspond(row, valeur)
    return correspond((row as Row)?.[cle], valeur)
  })
}

function base(document: Row | null, facture: Row | null) {
  const lectures: string[] = []
  const produit = { id: 7, userId: 'ferme-fictive', categorie: 'oeufs', unite: 'douzaine', recolteId: null, stockDispo: null, stockLieType: null }
  const tx = {
    $executeRaw: vi.fn(async () => { lectures.push('verrou'); return 1 }),
    $queryRaw: vi.fn(async () => { lectures.push('produit-verrouille'); return [] }),
    produitBoutique: {
      findFirst: vi.fn(async () => produit), findMany: async () => [produit],
      update: vi.fn(async () => produit),
    },
    ligneDocumentCommercial: { findFirst: vi.fn(async ({ where }: { where: Row }) => { lectures.push('documents'); return document && correspond(document, where) ? { id: 1 } : null }) },
    ligneFacture: { findFirst: vi.fn(async ({ where }: { where: Row }) => facture && correspond(facture, where) ? { id: 1 } : null) },
    ligneCommandeBoutique: { findMany: async () => [] },
    productionRuche: { findMany: async () => [] },
    productionOeuf: { count: async () => 1 },
    mouvementStockOeuf: { findMany: async () => [] },
    mouvementStockRuche: { findMany: async () => [] },
    commandeBoutique: { findMany: async () => [] },
  }
  const db = { $transaction: async (traiter: (client: typeof tx) => Promise<void>) => traiter(tx) } as unknown as PrismaClient
  return { tx, db, lectures, client: tx as unknown as Prisma.TransactionClient }
}
const ligne = { articleStockType: 'boutique', articleStockId: '7' }
const document = (type: string, statut: string, userId = 'ferme-fictive') => ({ ...ligne, document: { userId, type, statut, factureId: null, bonLivraison: null } })
const facture = (statut: string, userId = 'ferme-fictive') => ({ ...ligne, facture: { userId, type: 'facture', statut } })

const engagements: Array<[string, Row | null, Row | null, string]> = [
  ['devis brouillon', document('devis', 'brouillon'), null, 'bon ou un devis'],
  ['devis émis', document('devis', 'emis'), null, 'bon ou un devis'],
  ['devis accepté', document('devis', 'accepte'), null, 'bon ou un devis'],
  ['bon brouillon', document('livraison', 'brouillon'), null, 'bon ou un devis'],
  ['bon émis', document('livraison', 'emis'), null, 'bon ou un devis'],
  ['facture brouillon', null, facture('brouillon'), 'facture brouillon'],
]

describe('rattachement public avec les vraies gardes documents', () => {
  it.each(engagements)('%s : refus sous verrou, sans écriture et exclusion de la reprise', async (_nom, doc, fac, motif) => {
    const { tx, client, db, lectures } = base(doc, fac)
    await expect(relierProduitAuStock(client, 'ferme-fictive', 7, { type: 'oeufs', conditionnement: 12 })).rejects.toThrow(motif)
    expect(lectures.slice(0, 5)).toEqual(['verrou', 'verrou', 'produit-verrouille', 'documents'])
    expect(tx.produitBoutique.findFirst).toHaveBeenCalledWith({ where: { id: 7, userId: 'ferme-fictive' } })
    const journal = await reprendreStockLieExploitation(db, 'ferme-fictive')
    expect(journal.applique).toBe(false)
    expect(journal.evenements).toEqual([{ objet: 'produit', produitId: 7, issue: 'non_relie', raison: expect.stringContaining(motif) }])
    expect(tx.produitBoutique.update).not.toHaveBeenCalled()
  })

  it.each([
    ['produit libre', null, null],
    ['devis annulé', document('devis', 'annule'), null],
    ['bon livré', document('livraison', 'livre'), null],
    ['facture émise', null, facture('emise')],
    ['autre exploitation', document('devis', 'accepte', 'autre-ferme'), facture('brouillon', 'autre-ferme')],
  ] as Array<[string, Row | null, Row | null]>)('%s : rattachement autorisé sans délégué privé', async (_nom, doc, fac) => {
    const { tx, client, db } = base(doc, fac)
    expect(await motifBlocageRattachement(client, 'ferme-fictive', 7)).toBeNull()
    await relierProduitAuStock(client, 'ferme-fictive', 7, { type: 'oeufs', conditionnement: 12 })
    expect(tx.produitBoutique.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { stockLieType: 'oeufs', stockLieRef: 'stock', stockLieConditionnement: 12, stockLieMode: 'stock' } })
    const journal = await reprendreStockLieExploitation(db, 'ferme-fictive')
    expect(journal.evenements).toEqual([{ objet: 'produit', produitId: 7, issue: 'relie', type: 'oeufs', ref: 'stock', conditionnement: 12 }])
  })
})
