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
  depensesCategories: vi.fn(),
  mensuel: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/kpi', () => ({
  getKpiCompta: vi.fn(async () => ({
    revenusYtd: 0, depensesYtd: 0, beneficeYtd: 0, margePercentYtd: 0,
    revenusParModuleYtd: { parModule: { elevage: 0, verger: 0, potager: 0, autre: 0 }, composition: { avoirs: 0 } },
  })),
}))
vi.mock('@/lib/kpi/compta', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/kpi/compta')>()),
  chargerMensuelCompta: mocks.mensuel,
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
    'depenseManuelle.groupBy': mocks.depensesCategories,
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
  mocks.depensesCategories.mockResolvedValue([])
  mocks.mensuel.mockResolvedValue(Array.from({ length: 12 }, () => ({ revenus: 0, depenses: 0 })))
})

describe('GET /api/comptabilite/stats — dépenses du verger', () => {
  it('compte le coût réel des campagnes, daté comme dans Transactions', async () => {
    const res = await GET(new NextRequest(`http://localhost/api/comptabilite/stats?year=${annee}`))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.stats.depensesParModule.verger).toBe(300)
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

// Revue du 2026-11-01 — graphiques mensuel et par catégorie sur le total
// comptable, et non plus sur les tables brutes (coûts analytiques).
describe('GET /api/comptabilite/stats — graphiques sur le périmètre comptable', () => {
  it('reprend les mois comptables, bénéfice compris', async () => {
    const mois = Array.from({ length: 12 }, () => ({ revenus: 0, depenses: 0 }))
    mois[1] = { revenus: 200, depenses: 575.58 }
    mocks.mensuel.mockResolvedValue(mois)

    const j = await (await GET(new NextRequest(`http://localhost/api/comptabilite/stats?year=${annee}`))).json()

    expect(mocks.mensuel).toHaveBeenCalledWith('u1', annee, expect.any(Date))
    expect(j.charts.mensuel[1]).toEqual({ mois: 'Fév', revenus: 200, depenses: 575.58, benefice: -375.58 })
    expect(j.charts.mensuel.reduce((s: number, m: { depenses: number }) => s + m.depenses, 0)).toBeCloseTo(575.58, 2)
  })

  it('ventile par catégorie les seules charges comptables, achats d’animaux compris', async () => {
    mocks.depensesCategories.mockImplementation(async (args: { by: string[] }) => args.by.includes('categorie')
      ? [{ categorie: 'materiel', _sum: { montant: 24.99 } }, { categorie: 'achats', _sum: { montant: 550.59 } }]
      : [])

    const j = await (await GET(new NextRequest(`http://localhost/api/comptabilite/stats?year=${annee}`))).json()

    const parCategorie = mocks.depensesCategories.mock.calls.find((c) => c[0].by.includes('categorie'))
    expect(parCategorie?.[0].where).toEqual(expect.objectContaining({ userId: 'u1', comptable: true }))
    expect(j.charts.depensesParCategorie).toEqual([
      expect.objectContaining({ categorie: 'Achats d’animaux', montant: 550.59 }),
      expect.objectContaining({ categorie: 'Matériel', montant: 24.99 }),
    ])
    // Les campagnes (220 €, coût analytique) restent dans les modules seulement.
    expect(j.charts.depensesParCategorie.some((d: { categorie: string }) => d.categorie === 'Plantations')).toBe(false)
  })
})
