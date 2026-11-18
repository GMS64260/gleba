import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ reprendre: vi.fn(), ecrire: vi.fn(), deconnecter: vi.fn(), produits: vi.fn(), commandes: vi.fn() }))
vi.mock('./reprise-stock-lie', () => ({ reprendreStockLieExploitation: mocks.reprendre }))
vi.mock('node:fs', () => ({ writeFileSync: mocks.ecrire }))
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  $disconnect = mocks.deconnecter
  produitBoutique = { findMany: mocks.produits }
  commandeBoutique = { findMany: mocks.commandes }
} }))

const argv = process.argv
const code = process.exitCode
afterEach(() => {
  process.argv = argv
  process.exitCode = code
  vi.restoreAllMocks()
})

describe('script de reprise : restitution des exclusions', () => {
  it.each([false, true])('compte séparément les exclusions et signale la reprise incomplète (appliquer=%s)', async appliquer => {
    vi.resetModules()
    vi.clearAllMocks()
    const evenements = [
      { objet: 'ligne', commandeId: 1, ligneId: 1, issue: 'non_reprise', raison: 'produit_supprime' },
      { objet: 'ligne', commandeId: 2, ligneId: 2, issue: 'non_reprise', raison: 'unite_modifiee' },
    ]
    mocks.reprendre.mockResolvedValue({ userId: 'compte-fictif', applique: appliquer, evenements, rapprochements: {} })
    const sortie = vi.spyOn(console, 'log').mockImplementation(() => {})
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {})
    process.argv = ['node', 'reprise', '--user', 'compte-fictif', '--journal', 'journal-fictif.json', ...(appliquer ? ['--appliquer'] : [])]
    process.exitCode = undefined
    await import('../../../scripts/reprise-boutique-stock-lie')
    await vi.waitFor(() => expect(mocks.deconnecter).toHaveBeenCalledOnce())
    expect(mocks.reprendre).toHaveBeenCalledWith(expect.anything(), 'compte-fictif', appliquer)
    expect(sortie).toHaveBeenCalledWith(expect.stringContaining('0 ligne(s) sortie(s)'))
    expect(sortie).toHaveBeenCalledWith(expect.stringContaining('2 ligne(s) non reprise(s)'))
    expect(erreurs).toHaveBeenCalledWith(expect.stringContaining('2 ligne(s) non reprise(s)'))
    expect(process.exitCode).toBe(1)
    expect(sortie).toHaveBeenLastCalledWith(appliquer ? 'Reprise partielle : consultez le journal.' : expect.stringContaining('rien n’a été écrit'))
    expect(mocks.ecrire).toHaveBeenCalledWith('journal-fictif.json', expect.any(String))
    const journal = JSON.parse(mocks.ecrire.mock.calls.at(-1)![1] as string)
    expect(journal.applique).toBe(appliquer)
    expect(journal.journaux[0].evenements).toEqual(evenements)
  })

  it('--tous inclut une exploitation dont tous les produits ont été supprimés, une seule fois par compte', async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.produits.mockResolvedValue([{ userId: 'avec-produits' }])
    mocks.commandes.mockResolvedValue([{ userId: 'avec-produits' }, { userId: 'sans-produits' }])
    mocks.reprendre.mockImplementation(async (_prisma, userId) => ({ userId, applique: false, evenements: [], rapprochements: {} }))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    process.argv = ['node', 'reprise', '--tous']
    await import('../../../scripts/reprise-boutique-stock-lie')
    await vi.waitFor(() => expect(mocks.deconnecter).toHaveBeenCalledOnce())
    expect(mocks.reprendre.mock.calls.map(c => c[1])).toEqual(['avec-produits', 'sans-produits'])
    expect(mocks.reprendre.mock.calls.every(c => c[2] === false)).toBe(true)
  })
})
