import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ transaction: vi.fn(), stocks: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: async () => ({ session: { user: { id: 'ferme-fictive' } }, error: null }) }))
vi.mock('@/lib/prisma', () => ({ default: { $transaction: m.transaction } }))
vi.mock('@/lib/boutique/stock-lie-disponible', () => ({ listerStocksLiables: m.stocks }))
import { GET } from '@/app/api/elevage/stocks-lies/route'

describe('catalogue élevage : délai explicite, graine 20261118', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('conserve les stocks pour 256 catalogues dont la durée simulée dépasse cinq secondes', async () => {
    let graine = 20261118
    const suivant = () => (graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0)
    for (let i = 0; i < 256; i++) {
      // Simulation du budget Prisma, sans attente réelle ni accès à la base.
      const dureeCatalogue = 5001 + suivant() % 24999
      const stocks = [{ type: 'oeufs', ref: 'stock', disponible: suivant() % 10000, retenu: suivant() % 100 }]
      const tx = { catalogue: i }
      m.transaction.mockImplementation(async (lire: (client: object) => Promise<unknown>, options?: { timeout?: number }) => {
        const resultat = await lire(tx)
        if (dureeCatalogue > (options?.timeout ?? 5000)) throw new Error('Transaction expirée (simulation)')
        return resultat
      })
      m.stocks.mockResolvedValue(stocks)
      const reponse = await GET()
      expect(reponse.status).toBe(200)
      expect(await reponse.json()).toEqual(stocks)
      expect(reponse.headers.get('Cache-Control')).toBe('private, no-store')
      expect(m.stocks).toHaveBeenLastCalledWith(tx, 'ferme-fictive')
      expect(m.transaction).toHaveBeenLastCalledWith(expect.any(Function), { timeout: 30000 })
    }
  })
})
