/**
 * Revue du 2026-10-29 : le verger des Rapports ignorait le coût réel des
 * campagnes de plantation, compté par le KPI et Transactions, et comptait les
 * opérations d'arbre planifiées. Les écrans ne concordaient plus.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  campagnes: vi.fn(),
  operations: vi.fn(),
  arbres: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/kpi', () => ({
  getKpiCompta: vi.fn(async () => ({
    revenusYtd: 0, depensesYtd: 0, beneficeYtd: 0, margePercentYtd: 0,
    revenusParModuleYtd: { parModule: { elevage: 0, verger: 0, potager: 0, autre: 0 }, composition: { avoirs: 0 } },
  })),
}))
vi.mock('@/lib/comptabilite/encours', () => ({ chargerEncoursCompta: vi.fn(async () => ({ creances: { items: [] } })) }))
vi.mock('@/lib/prisma', () => {
  // Toute autre lecture rend un résultat vide de la forme attendue.
  const vide = (methode: string) => async () =>
    methode === 'aggregate' ? { _sum: {}, _count: 0 } : methode === 'count' ? 0 : methode.startsWith('findFirst') || methode === 'findUnique' ? null : []
  const choisis: Record<string, unknown> = {
    'campagnePlantation.aggregate': mocks.campagnes,
    'operationArbre.aggregate': mocks.operations,
    'arbre.aggregate': mocks.arbres,
  }
  const modele = (nom: string) => new Proxy({}, { get: (_, methode: string) => choisis[nom + '.' + methode] ?? vide(methode) })
  const racine: Record<string, unknown> = { $queryRaw: async () => [] }
  return { default: new Proxy(racine, { get: (cible, nom: string) => cible[nom] ?? modele(nom) }) }
})

import { GET } from './route'

const annee = 2026
const debut = new Date(annee, 0, 1)
const fin = new Date(annee, 11, 31, 23, 59, 59, 999)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  mocks.campagnes.mockResolvedValue({ _sum: { coutReel: 220 } })
  mocks.operations.mockResolvedValue({ _sum: { cout: 30 } })
  mocks.arbres.mockResolvedValue({ _sum: { prixAchat: 50 } })
})

describe('GET /api/comptabilite/stats — dépenses du verger', () => {
  it('compte le coût réel des campagnes, daté comme dans Transactions', async () => {
    const res = await GET(new NextRequest(`http://localhost/api/comptabilite/stats?year=${annee}`))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.stats.depensesParModule.verger).toBe(300)
    expect(j.charts.depensesParCategorie).toEqual(
      expect.arrayContaining([expect.objectContaining({ categorie: 'Plantations', montant: 220 })]),
    )
    expect(mocks.campagnes).toHaveBeenCalledWith({
      where: { userId: 'u1', coutReel: { gt: 0 }, OR: [
        { datePlantationReelle: { gte: debut, lte: fin } },
        { datePlantationReelle: null, datePlantationPrevue: { gte: debut, lte: fin } },
        { datePlantationReelle: null, datePlantationPrevue: null, createdAt: { gte: debut, lte: fin } },
      ] },
      _sum: { coutReel: true },
    })
  })

  it('exclut les opérations planifiées et date un arbre sans date à sa création', async () => {
    await GET(new NextRequest(`http://localhost/api/comptabilite/stats?year=${annee}`))
    expect(mocks.operations.mock.calls[0][0].where.NOT).toEqual({ fait: false })
    expect(mocks.arbres.mock.calls[0][0].where.OR).toContainEqual({ dateAchat: null, datePlantation: null, createdAt: { gte: debut, lte: fin } })
  })
})
