/**
 * Revue du 2026-10-29 : un arbre acheté sans date d'achat ni de plantation
 * était compté par le KPI (son miroir est daté de sa création) mais manquait à
 * la liste Transactions > Dépenses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), arbres: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/comptabilite/suivi-ecriture', () => ({ chargerSuiviDesDepenses: vi.fn(async () => new Map()) }))
vi.mock('@/lib/comptabilite/projection-reglements', () => ({
  enrichirLignesReglements: vi.fn(async (_u: string, _n: string, lignes: unknown[]) => lignes),
}))
vi.mock('@/lib/prisma', () => {
  const modele = (nom: string) => ({ findMany: nom === 'arbre' ? mocks.arbres : async () => [] })
  return { default: new Proxy({}, { get: (_, nom: string) => modele(nom) }) }
})

import { GET } from './route'

const creation = new Date('2026-04-02T09:00:00Z')
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  mocks.arbres.mockResolvedValue([{ id: 7, nom: 'Poirier QA', prixAchat: 40, fournisseur: null, dateAchat: null, datePlantation: null, createdAt: creation }])
})

describe('GET /api/comptabilite/depenses — achat d’arbre sans date', () => {
  it('le liste à sa date de création, comme son miroir comptable', async () => {
    const j = await (await GET(new NextRequest('http://localhost/api/comptabilite/depenses?year=2026'))).json()
    expect(mocks.arbres.mock.calls[0][0].where.OR).toContainEqual({
      dateAchat: null, datePlantation: null, createdAt: { gte: new Date(2026, 0, 1), lte: new Date(2026, 11, 31, 23, 59, 59) },
    })
    expect(j.data).toEqual([expect.objectContaining({ source: 'Arbre', date: creation.toISOString(), montant: 40, comptable: true })])
    expect(j.stats.totalComptable).toBe(40)
  })
})
