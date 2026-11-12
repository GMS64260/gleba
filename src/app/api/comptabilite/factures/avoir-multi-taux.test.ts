/**
 * COM-04 (revue Codex du 2026-11-12) : avoir sur une facture à plusieurs taux.
 *
 * Origine : 100 € HT à 20 % + 100 € HT à 5,5 % = 225,50 € TTC, dont 25,50 €
 * de TVA. Un avoir total de 225,50 € entièrement à 20 % (premier taux de la
 * facture, seul proposé par l'écran) retirait 37,58 € de TVA : solde de TVA
 * de −12,08 € au lieu de 0. Le serveur ne contrôlait que le TTC cumulé et
 * l'appartenance du taux.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  avoirsExistants: [] as Array<{ tauxTVA: number; montantHT: number; montantTVA: number; montantTTC: number }>,
  creerFacture: vi.fn(),
}))

const ORIGINE = {
  id: 50, numero: 'F-2026-0050', type: 'facture', statut: 'emise', totalTTC: 225.5, categorieOperation: 'biens',
  lignes: [
    { tauxTVA: 20, montantHT: 100, montantTVA: 20, montantTTC: 120 },
    { tauxTVA: 5.5, montantHT: 100, montantTVA: 5.5, montantTTC: 105.5 },
  ],
}

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'u1' } } }),
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/commercial/stock', () => ({
  verifierLignesStock: async (_tx: unknown, _u: string, lignes: unknown[]) => lignes,
  verrouillerStocksDesLignes: async () => undefined,
  sortirStockCommercial: async () => undefined,
}))
vi.mock('@/lib/facture-utils', () => ({
  creerFacture: m.creerFacture,
  montantAvoirsEmis: async () => 0,
  reserverProchainNumeroForEmission: vi.fn(),
  snapshotEmetteurForEmission: vi.fn(),
}))
vi.mock('@/lib/prisma', () => {
  const sommeAvoirs = async () => ({ _sum: { totalTTC: m.avoirsExistants.reduce((s, l) => s + l.montantTTC, 0) } })
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [{ id: ORIGINE.id, total_ttc: ORIGINE.totalTTC, statut: ORIGINE.statut, type: ORIGINE.type }],
    facture: { aggregate: sommeAvoirs, findUnique: async () => null },
    ligneFacture: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        'factureId' in where ? ORIGINE.lignes.map((l) => ({ ...l })) : m.avoirsExistants.map((l) => ({ ...l })),
    },
  }
  return {
    default: {
      facture: { findFirst: async () => ({ ...ORIGINE }), aggregate: sommeAvoirs },
      client: { findFirst: async () => null, findMany: async () => [] },
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
    },
  }
})

import { POST } from './route'

type Ligne = { tauxTVA: number; montantHT: number; montantTVA: number; montantTTC: number }
const avoir = (lignes: Ligne[]) => {
  const somme = (k: keyof Ligne) => Math.round(lignes.reduce((s, l) => s + l[k], 0) * 100) / 100
  return POST(new NextRequest('http://local.test/api/comptabilite/factures', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'avoir', factureOrigineId: ORIGINE.id, statut: 'emise', clientId: null, clientNom: 'Client',
      objet: 'Avoir', totalHT: somme('montantHT'), totalTVA: somme('montantTVA'), totalTTC: somme('montantTTC'),
      lignes: lignes.map((l) => ({ description: 'Retour', quantite: 1, unite: 'lot', prixUnitaire: l.montantHT, ...l })),
    }),
  }))
}

beforeEach(() => {
  m.avoirsExistants = []
  m.creerFacture.mockReset().mockImplementation(async (_tx: unknown, p: { lignes: unknown[] }) => ({ id: 99, numero: 'AV-2026-0001', lignes: p.lignes }))
})

describe('COM-04 : un avoir suit la ventilation par taux de sa facture', () => {
  it('avoir total de 225,50 € au seul taux de 20 % : refusé, rien n’est créé', async () => {
    const res = await avoir([{ tauxTVA: 20, montantHT: 187.92, montantTVA: 37.58, montantTTC: 225.5 }])
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/20 %/)
    expect(m.creerFacture).not.toHaveBeenCalled()
  })

  it('avoir total ventilé comme l’origine : accepté, solde de TVA nul', async () => {
    const res = await avoir(ORIGINE.lignes)
    expect(res.status).toBe(201)
    expect(m.creerFacture).toHaveBeenCalledOnce()
  })

  it('avoir partiel ventilé explicitement : accepté', async () => {
    const res = await avoir([
      { tauxTVA: 20, montantHT: 50, montantTVA: 10, montantTTC: 60 },
      { tauxTVA: 5.5, montantHT: 20, montantTVA: 1.1, montantTTC: 21.1 },
    ])
    expect(res.status).toBe(201)
  })

  it('plafond cumulé par taux : un second avoir à 5,5 % au-delà du reste est refusé', async () => {
    m.avoirsExistants = [{ tauxTVA: 5.5, montantHT: 80, montantTVA: 4.4, montantTTC: 84.4 }]
    const res = await avoir([{ tauxTVA: 5.5, montantHT: 30, montantTVA: 1.65, montantTTC: 31.65 }])
    expect(res.status).toBe(409)
    expect(m.creerFacture).not.toHaveBeenCalled()
  })

  it('ligne d’avoir dont la TVA ne correspond pas à son taux : refusée', async () => {
    const res = await avoir([{ tauxTVA: 20, montantHT: 10, montantTVA: 15, montantTTC: 25 }])
    // Déjà refusé par le schéma des lignes (400) ; le contrôle serveur le couvre aussi.
    expect([400, 409]).toContain(res.status)
    expect(m.creerFacture).not.toHaveBeenCalled()
  })
})
