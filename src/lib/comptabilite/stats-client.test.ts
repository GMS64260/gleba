import { describe, expect, it, vi } from 'vitest'
import { chargerStatsComptables } from './stats-client'

describe('Chargement des statistiques avec contrat par devise', () => {
  const reponse = { stats: { revenus: null, revenusParDevise: [{ monnaie: 'EUR', total: 10 }, { monnaie: 'XPF', total: 20 }] } }
  it.each([200, 500])('utilise le raccord si la route historique ne fournit pas la ventilation (HTTP %s)', async status => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ stats: { revenus: 30 } }, { status }))
      .mockResolvedValueOnce(Response.json(reponse))
    expect(await chargerStatsComptables(2026, fetcher)).toEqual(reponse)
    expect(fetcher.mock.calls.map(c => c[0])).toEqual(['/api/comptabilite/stats?year=2026', '/api/comptabilite/stats/devises?year=2026'])
  })
  it('un raccord sans ventilation ne rend aucun ancien cumul', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ stats: { revenus: 30 } }))
    // Deux objets Response indépendants pour permettre deux lectures du corps.
    fetcher.mockImplementation(async () => Response.json({ stats: { revenus: 30 } }))
    expect(await chargerStatsComptables(2026, fetcher)).toBeNull()
  })
  it.each([401, 403])('respecte le refus HTTP %s sans deuxième lecture', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status }))
    expect(await chargerStatsComptables(2026, fetcher)).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
