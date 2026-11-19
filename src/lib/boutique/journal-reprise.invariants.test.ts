import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

const stock = vi.hoisted(() => ({ sortir: vi.fn() }))
vi.mock('@/lib/commercial/stock', () => ({
  verrouillerStocksDesLignes: async () => {},
  sortirStockCommercial: (...args: unknown[]) => stock.sortir(...args),
}))
vi.mock('./stock-lie-disponible', () => ({
  listerStocksLiables: async () => [
    { type: 'oeufs', ref: 'stock', unite: 'pièce', produit: true },
    { type: 'ruche', ref: 'miel', unite: 'kg', produit: true },
  ],
}))
vi.mock('@/lib/prisma', () => ({ default: {} }))
import { reprendreStockLieExploitation } from './reprise-stock-lie'

const GRAINE = 0x18b009
const SCENARIOS = 320
function generateur() {
  let etat = GRAINE
  return (max: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return etat % max
  }
}

// La reprise et les événements sont réels ; PostgreSQL, le FIFO et les verrous
// sont remplacés ici. Le filtre SQL incluant le produit supprimé a ses témoins
// dans boutique-stock-lie.integration.test.ts.
describe(`journal des exclusions : graine ${GRAINE}, ${SCENARIOS} entrées par propriété`, () => {
  it.each(['produit_supprime', 'unite_modifiee'] as const)('%s : une seule raison par ligne, aucune sortie ni mutation, y compris au rejeu', async (raison) => {
    const alea = generateur()
    for (let scenario = 0; scenario < SCENARIOS; scenario++) {
      const contexte = `graine=${GRAINE}, scénario=${scenario}, raison=${raison}`
      const userId = `exploitation-fictive-${scenario}`
      const commandeId = 1 + alea(100000)
      const exclusions = Array.from({ length: 1 + alea(8) }, (_, i) => {
        const oeufs = alea(13) < 7
        const unite = oeufs ? 'douzaine' : 'kg'
        return {
          id: i + 1, commandeId, unite, quantite: 1 + alea(100), prixUnitaire: alea(10000) / 100,
          nom: 'Nom fictif absent du journal', stockLieType: null, stockLieRef: null, stockLieConditionnement: null, stockLieMode: null,
          produit: raison === 'produit_supprime' ? null : {
            unite: oeufs ? 'pièce' : 'g', stockLieType: oeufs ? 'oeufs' : 'ruche', stockLieRef: oeufs ? 'stock' : 'miel',
            stockLieConditionnement: oeufs ? 1 : 0.001, stockLieMode: alea(13) < 7 ? 'stock' : 'a_produire',
          },
          mouvementsStock: [],
        }
      })
      const avant = JSON.stringify(exclusions)
      // Un lien déjà figé reste exploitable même après suppression du produit.
      const valide = { id: 100, nom: 'Témoin fictif', produit: null, quantite: 1 + alea(10), stockLieType: 'oeufs', stockLieRef: 'stock', stockLieConditionnement: 6, stockLieMode: 'stock' }
      let sorties: Array<{ id: number; quantite: number }> = []
      const tx = {
        produitBoutique: { findMany: async () => [] },
        ligneCommandeBoutique: {
          findMany: async () => exclusions,
          update: vi.fn(async () => { throw new Error('Une exclusion ne doit pas recevoir de lien') }),
        },
        mouvementStockOeuf: { findMany: async () => [] },
        mouvementStockRuche: { findMany: async () => [] },
        commandeBoutique: { findMany: async () => [{
          id: commandeId, numero: 'COMMANDE-FICTIVE', statut: 'livree', venteManuelle: null,
          createdAt: new Date(Date.UTC(2026, 0, 1 + alea(90))),
          lignes: [{ ...valide, mouvementsStock: sorties.length ? [{ id: 'sortie-fictive' }] : [] }],
        }] },
        $executeRawUnsafe: async () => 0,
      }
      const db = { $transaction: async (traiter: (client: typeof tx) => Promise<void>) => {
        const avantSorties = [...sorties]
        try { await traiter(tx) } catch (e) { sorties = avantSorties; throw e }
      } } as unknown as PrismaClient
      stock.sortir.mockImplementation(async (_tx: unknown, _userId: string, lignes: Array<{ id: number; quantite: number }>) => {
        sorties.push(...lignes.map(({ id, quantite }) => ({ id, quantite })))
      })
      for (const appliquer of [false, true, true]) {
        const journal = await reprendreStockLieExploitation(db, userId, appliquer)
        for (const ligne of exclusions) {
          // Égalité exacte : pas de deuxième raison, de quantité, de nom ou de
          // données client dans l'événement ; aucune sortie pour cette ligne.
          expect(journal.evenements.filter(e => e.objet === 'ligne' && e.ligneId === ligne.id), contexte).toEqual([
            { objet: 'ligne', commandeId, ligneId: ligne.id, issue: 'non_reprise', raison },
          ])
          expect(sorties.filter(s => s.id === ligne.id), contexte).toEqual([])
        }
        expect(sorties, contexte).toEqual(appliquer ? [{ id: valide.id, quantite: valide.quantite * 6 }] : [])
        expect(tx.ligneCommandeBoutique.update, contexte).not.toHaveBeenCalled()
        expect(JSON.stringify(exclusions), contexte).toBe(avant)
      }
    }
  })
})
