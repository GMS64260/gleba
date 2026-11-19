import type { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ default: {} }))
import { motifBlocageRattachementDocuments as motifBlocageRattachement } from '@/lib/commercial/engagements-documents'

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

describe('engagements des documents avant rattachement', () => {
  it('aucun document restant à servir ne perd sa source — graine 0x50b0, 480 scénarios', async () => {
    let graine = 0x50b0
    const alea = (n: number) => { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; return graine % n }
    const statuts = ['brouillon', 'emis', 'accepte', 'refuse', 'livre', 'retourne', 'annule']
    let proteges = 0, libres = 0
    for (let i = 0; i < 480; i++) {
      const type = i % 2 ? 'devis' : 'livraison'
      const statut = statuts[alea(statuts.length)]
      const userId = alea(5) ? 'ferme-fictive' : 'autre-ferme'
      const articleStockId = String(1 + alea(3))
      const articleStockType = alea(5) ? 'boutique' : 'fruit'
      const factureId = alea(7) ? null : 17
      const bonLivraison = alea(7) ? null : { id: 'bon-fictif' }
      const ligne = { id: 'ligne-fictive', articleStockType, articleStockId, document: { userId, type, statut, factureId, bonLivraison } }
      const db = {
        ligneFacture: { findFirst: async () => null },
        ligneDocumentCommercial: { findFirst: async ({ where }: { where: Row }) => correspond(ligne, where) ? ligne : null },
      } as unknown as Prisma.TransactionClient
      const actif = statut === 'brouillon' || statut === 'emis' || (type === 'devis' && statut === 'accepte')
      const attendu = userId === 'ferme-fictive' && articleStockId === '1' && articleStockType === 'boutique' && actif && factureId === null && bonLivraison === null
      const avant = JSON.stringify(ligne)
      const motif = await motifBlocageRattachement(db, 'ferme-fictive', 1)
      expect(motif !== null, `scénario ${i} : ${avant}`).toBe(attendu)
      expect(JSON.stringify(ligne)).toBe(avant)
      if (attendu) proteges++; else libres++
    }
    expect(proteges).toBeGreaterThan(0)
    expect(libres).toBeGreaterThan(0)
  })

  it('les factures à émettre gardent leur source, sans bloquer les pièces terminées — graine 0x50fa, 480 scénarios', async () => {
    let graine = 0x50fa
    const alea = (n: number) => { graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0; return graine % n }
    let proteges = 0, libres = 0
    for (let i = 0; i < 480; i++) {
      const statut = ['brouillon', 'emise', 'payee', 'annulee'][alea(4)]
      const type = alea(5) ? 'facture' : 'avoir'
      const userId = alea(5) ? 'ferme-fictive' : 'autre-ferme'
      const articleStockId = String(1 + alea(3))
      const articleStockType = alea(5) ? 'boutique' : 'fruit'
      const ligne = { id: 1, articleStockId, articleStockType, facture: { userId, type, statut } }
      const db = {
        ligneDocumentCommercial: { findFirst: async () => null },
        ligneFacture: { findFirst: async ({ where }: { where: Row }) => correspond(ligne, where) ? ligne : null },
      } as unknown as Prisma.TransactionClient
      const attendu = userId === 'ferme-fictive' && articleStockId === '1' && articleStockType === 'boutique' && type === 'facture' && statut === 'brouillon'
      const avant = JSON.stringify(ligne)
      expect((await motifBlocageRattachement(db, 'ferme-fictive', 1)) !== null, `scénario ${i} : ${avant}`).toBe(attendu)
      expect(JSON.stringify(ligne)).toBe(avant)
      if (attendu) proteges++; else libres++
    }
    expect(proteges).toBeGreaterThan(0)
    expect(libres).toBeGreaterThan(0)
  })
})
