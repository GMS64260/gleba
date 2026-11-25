/**
 * Revue du 2026-10-29 : un arbre acheté sans date d'achat ni de plantation
 * était compté par le KPI (son miroir est daté de sa création) mais manquait à
 * la liste Transactions > Dépenses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), arbres: vi.fn(), exploitation: vi.fn(), dossiers: vi.fn(), depenses: vi.fn(), fertilisations: vi.fn(async (): Promise<unknown[]> => []) }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
// Garder les vrais helpers de suivi : la simulation de Prisma suffit et
// évite une fabrique partielle périmée ou un import direct de surcharge privée.
vi.mock('@/lib/comptabilite/projection-reglements', () => ({
  enrichirLignesReglements: vi.fn(async (_u: string, _n: string, lignes: unknown[]) => lignes),
}))
vi.mock('@/lib/prisma', () => {
  const modele = (nom: string) => ({
    findMany: nom === 'fertilisation' ? mocks.fertilisations : nom === 'arbre' ? mocks.arbres : nom === 'cibleReglement' ? mocks.dossiers : nom === 'depenseManuelle' ? mocks.depenses : async () => [],
    findUnique: nom === 'exploitation' ? mocks.exploitation : async () => null,
  })
  return { default: new Proxy({}, { get: (_, nom: string) => modele(nom) }) }
})

import { GET } from './route'

const creation = new Date('2026-04-02T09:00:00Z')
beforeEach(() => {
  vi.clearAllMocks()
  mocks.exploitation.mockResolvedValue({ devise: 'EUR', territoire: 'METROPOLE' })
  mocks.dossiers.mockResolvedValue([])
  mocks.depenses.mockResolvedValue([])
  mocks.auth.mockResolvedValue({ error: null, session: { user: { id: 'u1' } } })
  mocks.arbres.mockResolvedValue([{ id: 7, nom: 'Poirier QA', prixAchat: 40, fournisseur: null, dateAchat: null, datePlantation: null, createdAt: creation }])
})

describe('GET /api/comptabilite/depenses — achat d’arbre sans date', () => {
  it('le liste à sa date de création, comme son miroir comptable', async () => {
    const response = await GET(new NextRequest('http://localhost/api/comptabilite/depenses?year=2026'))
    expect(response.status).toBe(200)
    const j = await response.json()
    expect(mocks.arbres.mock.calls[0][0].where.OR).toContainEqual({
      dateAchat: null, datePlantation: null, createdAt: { gte: new Date(2026, 0, 1), lte: new Date(2026, 11, 31, 23, 59, 59) },
    })
    expect(j.data).toEqual([expect.objectContaining({ source: 'Arbre', date: creation.toISOString(), montant: 40, comptable: true })])
    expect(j.stats.totalComptable).toBe(40)
    expect(mocks.exploitation).toHaveBeenCalledWith({ where: { userId: 'u1' }, select: { devise: true, territoire: true } })
    expect(mocks.dossiers).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'u1' }),
    }))
    expect(j.stats.parDevise).toEqual([expect.objectContaining({ monnaie: 'EUR', total: 40 })])
  })
})

// FB-7C4K9D (2026-11-24) : les frais de marché d'une clôture de caisse sont un
// miroir automatique sans table d'origine. Les rapports les comptaient, la
// liste les écartait avec tous les miroirs.
describe('GET /api/comptabilite/depenses — miroir automatique sans source relue', () => {
  it('liste les frais de marché de la caisse, comptés et non modifiables', async () => {
    mocks.arbres.mockResolvedValue([])
    const frais = { id: 31, date: new Date('2026-06-06T00:00:00Z'), categorie: 'autre', description: 'Frais de marché', montant: 15, module: null, paye: false, auto: true, sourceType: 'caisse', sourceId: null, sourceRef: 'session-1', comptable: true }
    mocks.depenses.mockImplementation(async ({ where }: { where: { OR?: unknown } }) => (where.OR ? [frais] : []))

    const j = await (await GET(new NextRequest('http://localhost/api/comptabilite/depenses?year=2026'))).json()

    expect(mocks.depenses.mock.calls[0][0].where.OR).toEqual([
      { auto: { not: true } },
      { auto: true, sourceType: { in: ['caisse'] } },
    ])
    expect(j.data).toEqual([expect.objectContaining({ source: 'DepenseManuelle', sourceId: 31, description: 'Frais de marché', montant: 15, comptable: true, corrigeable: false })])
    expect(j.stats.totalComptable).toBe(15)
    // Le dossier de règlement est celui du miroir (caisse, session), pas celui
    // d'une saisie manuelle : sinon un règlement posé ailleurs serait ignoré.
    const cles = JSON.stringify(mocks.dossiers.mock.calls.at(-1)?.[0].where.cle.in)
    expect(cles).toContain('caisse')
    expect(cles).toContain('session-1')
  })
})

// Défaut D19 de l'équipe debug (2026-11-25) : trois miroirs de fertilisation
// dont la fertilisation a disparu avec sa planche. Rapports : 770 € ;
// Transactions et le CSV détaillé : aucune ligne.
describe('GET /api/comptabilite/depenses — miroir comptable dont la source a disparu', () => {
  const miroir = (id: number, sourceId: number, montant: number) => ({
    id, date: new Date('2026-05-10T00:00:00Z'), categorie: 'intrants', description: `Fertilisation ${sourceId}`, montant,
    module: 'potager', paye: true, auto: true, sourceType: 'fertilisation', sourceId, sourceRef: null, comptable: true,
  })
  // La requête des miroirs comptables se reconnaît à son filtre `comptable`.
  const servir = (miroirs: unknown[]) => mocks.depenses.mockImplementation(
    async ({ where }: { where: { comptable?: boolean } }) => (where.comptable === true ? miroirs : []))
  const lire = async () => (await GET(new NextRequest('http://localhost/api/comptabilite/depenses?year=2026'))).json()

  beforeEach(() => {
    mocks.arbres.mockResolvedValue([])
    mocks.fertilisations.mockResolvedValue([])
  })

  it('liste les trois miroirs orphelins : même total que les rapports, non modifiables', async () => {
    servir([miroir(41, 1, 300), miroir(42, 2, 270), miroir(43, 3, 200)])
    const j = await lire()
    expect(j.data).toHaveLength(3)
    for (const ligne of j.data) expect(ligne).toMatchObject({ source: 'DepenseManuelle', comptable: true, corrigeable: false, sourceAbsente: true })
    expect(j.stats.totalComptable).toBe(770)
    // Dossier de règlement du miroir, pas celui d'une saisie manuelle.
    expect(JSON.stringify(mocks.dossiers.mock.calls.at(-1)?.[0].where.cle.in)).toContain('fertilisation')
  })

  it('ne liste pas le miroir en plus de sa fertilisation : une ligne, au montant comptable', async () => {
    servir([miroir(41, 1, 300)])
    mocks.fertilisations.mockResolvedValue([{
      id: 1, date: new Date('2026-05-10T00:00:00Z'), quantite: 10, plancheId: 'P1',
      fertilisant: { id: 'Compost', prix: 12, userStocks: [] },
    }])
    const j = await lire()
    expect(j.data).toEqual([expect.objectContaining({ source: 'Fertilisation', sourceId: 1, montant: 300, prixUnitaire: 30, comptable: true })])
    expect(j.stats.totalComptable).toBe(300)
    expect(j.stats.totalAnalytique).toBe(0)
  })

  it('ne liste pas le miroir d’un achat d’arbre en plus de l’arbre', async () => {
    mocks.arbres.mockResolvedValue([{ id: 7, nom: 'Poirier QA', prixAchat: 40, fournisseur: null, dateAchat: null, datePlantation: null, createdAt: new Date('2026-04-02T09:00:00Z') }])
    servir([{ ...miroir(51, 7, 40), sourceType: 'achat_arbre' }])
    const j = await lire()
    expect(j.data).toEqual([expect.objectContaining({ source: 'Arbre', sourceId: 7, montant: 40 })])
    expect(j.stats.totalComptable).toBe(40)
  })

  it('garde en coût interne une fertilisation sans miroir comptable', async () => {
    servir([])
    mocks.fertilisations.mockResolvedValue([{
      id: 2, date: new Date('2026-05-10T00:00:00Z'), quantite: 10, plancheId: 'P1',
      fertilisant: { id: 'Compost', prix: 12, userStocks: [] },
    }])
    const j = await lire()
    expect(j.data).toEqual([expect.objectContaining({ source: 'Fertilisation', montant: 120, comptable: false })])
    expect(j.stats.totalComptable).toBe(0)
  })
})

