/**
 * COM-01 (revue Codex du 2026-11-12) : émettre un brouillon après un
 * changement de régime de TVA.
 *
 * `creerFacture` applique la franchise (art. 293 B) ou l'exonération du client
 * aux lignes, aux totaux et aux mentions au moment du brouillon. À l'émission,
 * le PATCH ne rafraîchissait que l'instantané de l'émetteur : un brouillon
 * HT 100 + TVA 20 créé au réel, émis après passage en franchise, sortait avec
 * l'instantané « franchise-293b » mais 20 € de TVA facturée (due, art. 283-3
 * CGI) et sans mention 293 B ; l'inverse gardait une TVA de 0 au réel.
 *
 * Les lignes d'un brouillon passé à TVA 0 ont perdu leurs taux : un recalcul
 * fidèle est impossible. L'émission est refusée (409) quand la fiscalité a
 * changé ; le brouillon se recrée.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  facture: null as null | Record<string, unknown>,
  regimeEmission: 'reel-simplifie' as string | null,
  client: null as null | Record<string, unknown>,
  update: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'u1' } } }),
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/commercial/stock', () => ({
  verifierLignesStock: vi.fn(),
  verrouillerStocksDesLignes: async () => undefined,
  sortirStockCommercial: async () => undefined,
}))
vi.mock('@/lib/comptabilite/suivi-reglement-source', () => ({
  suiviReglementActif: async () => null,
  suiviReglementParCle: async () => null,
}))
vi.mock('@/lib/facture-utils', () => ({
  creerFacture: vi.fn(),
  montantAvoirsEmis: async () => 0,
  reserverProchainNumeroForEmission: async () => ({ numero: 'F-2026-0001' }),
  snapshotEmetteurForEmission: async () => (m.regimeEmission === null ? null : { regimeTva: m.regimeEmission }),
}))
vi.mock('@/lib/prisma', () => {
  const tx = {
    $executeRaw: async () => 0,
    $queryRaw: async () => [{ id: 7 }],
    facture: {
      findFirstOrThrow: async () => ({ ...m.facture }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        m.update(data)
        return { ...m.facture, ...data }
      },
    },
    client: { findFirst: async () => m.client },
    venteProduit: { updateMany: async () => ({ count: 0 }) },
  }
  return {
    default: {
      facture: { findFirst: async () => ({ ...m.facture }) },
      mouvementStockCommercial: { count: async () => 0 },
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
    },
  }
})

import { PATCH } from './route'

const emettre = () =>
  PATCH(new NextRequest('http://local.test/api/comptabilite/factures', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 7, statut: 'emise' }),
  }))

const brouillon = (regime: string | null, avecTva: boolean, extra: Record<string, unknown> = {}) => ({
  id: 7, userId: 'u1', type: 'facture', statut: 'brouillon', clientId: null, numero: 'BR-1',
  objet: 'Repro', notes: null, dateLivraison: null,
  emetteurSnapshot: regime === null ? null : { regimeTva: regime },
  totalHT: avecTva ? 100 : 120, totalTVA: avecTva ? 20 : 0, totalTTC: 120,
  mentionsSpecifiques: regime === 'franchise-293b' ? ['293b', 'escompte'] : ['escompte'],
  lignes: [{ id: 1, tauxTVA: avecTva ? 20 : 0, montantHT: avecTva ? 100 : 120, montantTVA: avecTva ? 20 : 0, montantTTC: 120 }],
  ...extra,
})

beforeEach(() => {
  m.update.mockClear()
  m.client = null
})

describe('COM-01 : fiscalité changée entre le brouillon et l’émission', () => {
  it('réel → franchise 293 B : émission refusée, rien n’est écrit', async () => {
    m.facture = brouillon('reel-simplifie', true)
    m.regimeEmission = 'franchise-293b'
    const res = await emettre()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/régime de TVA/)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('franchise 293 B → réel : émission refusée (TVA 0 et mention 293 B périmées)', async () => {
    m.facture = brouillon('franchise-293b', false)
    m.regimeEmission = 'reel-normal'
    const res = await emettre()
    expect(res.status).toBe(409)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('client devenu exonéré alors que le brouillon facture de la TVA : refusée', async () => {
    m.facture = brouillon('reel-simplifie', true, { clientId: 3 })
    m.regimeEmission = 'reel-simplifie'
    m.client = { id: 3, nom: 'Client', exonererTVA: true }
    const res = await emettre()
    expect(res.status).toBe(409)
    expect(m.update).not.toHaveBeenCalled()
  })

  it('régime inchangé : l’émission passe comme avant', async () => {
    m.facture = brouillon('reel-simplifie', true)
    m.regimeEmission = 'reel-simplifie'
    const res = await emettre()
    expect(res.status).toBe(200)
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ numero: 'F-2026-0001', statut: 'emise' }))
  })

  it('réel simplifié → réel normal (même traitement de TVA) : l’émission passe', async () => {
    m.facture = brouillon('reel-simplifie', true)
    m.regimeEmission = 'reel-normal'
    expect((await emettre()).status).toBe(200)
  })

  it('franchise inchangée : l’émission passe', async () => {
    m.facture = brouillon('franchise-293b', false)
    m.regimeEmission = 'franchise-293b'
    expect((await emettre()).status).toBe(200)
  })
})
