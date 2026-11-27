import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { CONTEXTE_FISCAL_VENTE_DISPONIBLE } from '@/lib/comptabilite/devise-vente'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), ventes: vi.fn(), factures: vi.fn(), exploitation: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ default: {
  venteManuelle: { findMany: mocks.ventes }, exploitation: { findUnique: mocks.exploitation },
} }))
// Les factures viennent du même chargeur que la liste des revenus (D231).
vi.mock('@/lib/kpi/compta', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/kpi/compta')>()),
  chargerFacturesRevenus: mocks.factures,
}))
import { GET } from './route'

const contexte = (devise: 'EUR' | 'XPF') => ({ version: 1, regimeTva: 'tgc', territoire: 'NOUVELLE_CALEDONIE', devise, date: '2026-07-01T10:00:00.000Z' })
const sansLiens = { moduleSource: null, date: new Date('2026-07-01T10:00:00.000Z') }
const appeler = async (module?: string) => (await GET(new NextRequest(`http://localhost/api/comptabilite/sources?year=2026${module ? `&module=${module}` : ''}`))).json()

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ error: null, session: { user: { id: 'qa' } } })
  mocks.ventes.mockResolvedValue([])
  mocks.factures.mockResolvedValue([])
  mocks.exploitation.mockResolvedValue({ devise: 'EUR', territoire: 'METROPOLE' })
})

describe('GET /api/comptabilite/sources : une ligne par devise, jamais EUR + XPF', () => {
  it('deux factures de 100 EUR et 100 XPF restent sur deux lignes, chacune avec sa devise figée', async () => {
    mocks.factures.mockResolvedValue([
      { type: 'facture', totalTTC: 100, emetteurSnapshot: { devise: 'EUR' }, ...sansLiens },
      { type: 'facture', totalTTC: 100, emetteurSnapshot: { devise: 'XPF' }, ...sansLiens },
    ])
    const j = await appeler()
    const lignes = j.sources.filter((s: { source: string }) => s.source === 'facture')
    expect(lignes).toHaveLength(2)
    expect(lignes.map((l: { monnaie: string; montant: number }) => [l.monnaie, l.montant]).sort()).toEqual([['EUR', 100], ['XPF', 100]])
    expect(lignes.some((l: { montant: number }) => l.montant === 200)).toBe(false)
    expect(j.parDevise).toEqual(expect.arrayContaining([{ monnaie: 'EUR', total: 100 }, { monnaie: 'XPF', total: 100 }]))
    expect(j.parDevise).toHaveLength(2)
  })
  it('une vente manuelle figée en XPF sur une ferme passée en EUR garde sa devise', async () => {
    mocks.ventes.mockResolvedValue([
      { montant: 100, module: 'maraichage', sourceType: null, auto: false, contexteFiscal: contexte('XPF') },
      { montant: 100, module: 'maraichage', sourceType: null, auto: false, contexteFiscal: null },
    ])
    const j = await appeler()
    const lignes = j.sources.filter((s: { source: string }) => s.source === 'manuel')
    expect(lignes.map((l: { monnaie: string; montant: number }) => [l.monnaie, l.montant]).sort()).toEqual([['EUR', 100], ['XPF', 100]])
  })
  it('charge le contexte fiscal figé des ventes quand le client Prisma connaît la colonne', async () => {
    await appeler()
    const select = mocks.ventes.mock.calls[0][0].select
    expect('contexteFiscal' in select).toBe(CONTEXTE_FISCAL_VENTE_DISPONIBLE)
    expect(mocks.ventes.mock.calls[0][0].where.userId).toBe('qa')
  })

  it('applique le filtre d’atelier de la liste, ventes sans module comprises (D231)', async () => {
    mocks.ventes.mockResolvedValue([
      { montant: 40, module: 'elevage', categorie: 'oeufs', sourceType: 'vente_produit', auto: true, contexteFiscal: null },
      // Sans module mais de catégorie potagère : rangée au potager, comme dans la liste.
      { montant: 25, module: null, categorie: 'legumes', sourceType: null, auto: false, contexteFiscal: null },
    ])
    mocks.factures.mockResolvedValue([
      { type: 'facture', totalTTC: 100, emetteurSnapshot: { devise: 'EUR' }, ...sansLiens, moduleSource: 'elevage' },
    ])

    const potager = await appeler('potager')
    expect(potager.sources.map((s: { module: string; montant: number }) => [s.module, s.montant])).toEqual([['potager', 25]])

    const tout = await appeler()
    expect(tout.sources.reduce((somme: number, s: { montant: number }) => somme + s.montant, 0)).toBe(165)
  })
})
