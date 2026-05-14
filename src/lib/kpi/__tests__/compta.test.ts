import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearKpiCache } from '../cache'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      venteManuelle: { aggregate: vi.fn() },
      depenseManuelle: { aggregate: vi.fn() },
      facture: { findMany: vi.fn() },
    },
  }
})

import prisma from '@/lib/prisma'
import { getKpiCompta } from '../compta'

type AnyMock = ReturnType<typeof vi.fn>
const mocked = prisma as unknown as {
  venteManuelle: { aggregate: AnyMock }
  depenseManuelle: { aggregate: AnyMock }
  facture: { findMany: AnyMock }
}

describe('getKpiCompta', () => {
  beforeEach(() => {
    clearKpiCache()
    vi.clearAllMocks()
    mocked.venteManuelle.aggregate.mockResolvedValue({ _sum: { montant: 0 } })
    mocked.depenseManuelle.aggregate.mockResolvedValue({ _sum: { montant: 0 } })
    mocked.facture.findMany.mockResolvedValue([])
  })

  it('somme VenteManuelle + LigneFacture (factures non annulées) pour les revenus', async () => {
    mocked.venteManuelle.aggregate
      .mockResolvedValueOnce({ _sum: { montant: 1000 } }) // YTD
      .mockResolvedValueOnce({ _sum: { montant: 800 } })  // N1 YTD
      .mockResolvedValueOnce({ _sum: { montant: 1500 } }) // N1 total
    mocked.facture.findMany
      .mockResolvedValueOnce([
        { type: 'facture', totalTTC: 500 },
        { type: 'avoir', totalTTC: 100 }, // soustrait
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const kpi = await getKpiCompta('user-1', 2026, new Date('2026-05-14'))

    expect(kpi.revenusYtd).toBe(1400) // 1000 + (500 - 100)
    expect(kpi.revenusN1Ytd).toBe(800)
    expect(kpi.revenusN1Total).toBe(1500)
  })

  it("calcule bénéfice et marge à 0 quand aucun revenu n'est saisi", async () => {
    mocked.depenseManuelle.aggregate.mockResolvedValue({ _sum: { montant: 250 } })

    const kpi = await getKpiCompta('user-2', 2026, new Date('2026-05-14'))

    expect(kpi.revenusYtd).toBe(0)
    expect(kpi.beneficeYtd).toBe(-250) // dépense sans revenu = perte
    expect(kpi.margePercentYtd).toBe(0) // division par 0 → 0, pas NaN
  })

  it("ignore les factures annulées et brouillon — exclusion au niveau requête", async () => {
    await getKpiCompta('user-3', 2026, new Date('2026-05-14'))
    expect(mocked.facture.findMany).toHaveBeenCalled()
    const args = mocked.facture.findMany.mock.calls[0][0]
    expect(args.where.statut).toEqual({ notIn: ['annulee', 'brouillon'] })
  })

  it("compare YTD vs YTD année dernière (et expose aussi N-1 total séparément)", async () => {
    mocked.venteManuelle.aggregate
      .mockResolvedValueOnce({ _sum: { montant: 100 } })
      .mockResolvedValueOnce({ _sum: { montant: 50 } })
      .mockResolvedValueOnce({ _sum: { montant: 300 } })

    const kpi = await getKpiCompta('user-4', 2026, new Date('2026-05-14'))

    expect(kpi.revenusN1Ytd).toBe(50)
    expect(kpi.revenusN1Total).toBe(300)
    // Une variation honnête doit utiliser N1Ytd (50), donnant +100 %.
    // L'UI ne doit JAMAIS comparer 100 à 300 quand on est en mai.
  })

  it('mémoïse : deuxième appel ne refait pas les agrégations', async () => {
    await getKpiCompta('user-mem', 2026, new Date('2026-05-14'))
    const facturesCalls = mocked.facture.findMany.mock.calls.length
    await getKpiCompta('user-mem', 2026, new Date('2026-05-14'))
    expect(mocked.facture.findMany.mock.calls.length).toBe(facturesCalls)
  })
})
