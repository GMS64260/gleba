import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearKpiCache } from '../cache'

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      venteManuelle: { aggregate: vi.fn(), findMany: vi.fn() },
      depenseManuelle: { aggregate: vi.fn() },
      facture: { findMany: vi.fn() },
      recolte: { findMany: vi.fn() },
    },
  }
})

import prisma from '@/lib/prisma'
import { getKpiCompta } from '../compta'

type AnyMock = ReturnType<typeof vi.fn>
const mocked = prisma as unknown as {
  venteManuelle: { aggregate: AnyMock; findMany: AnyMock }
  depenseManuelle: { aggregate: AnyMock }
  facture: { findMany: AnyMock }
  recolte: { findMany: AnyMock }
}

describe('getKpiCompta', () => {
  beforeEach(() => {
    clearKpiCache()
    vi.clearAllMocks()
    mocked.venteManuelle.aggregate.mockResolvedValue({ _sum: { montant: 0 } })
    mocked.venteManuelle.findMany.mockResolvedValue([])
    mocked.depenseManuelle.aggregate.mockResolvedValue({ _sum: { montant: 0 } })
    mocked.facture.findMany.mockResolvedValue([])
    mocked.recolte.findMany.mockResolvedValue([])
  })

  it('somme VenteManuelle + LigneFacture (factures non annulées) pour les revenus', async () => {
    // YTD : lignes ventilées ; N-1 : agrégats.
    mocked.venteManuelle.findMany.mockResolvedValueOnce([{ montant: 1000, module: 'potager', categorie: 'legumes' }])
    mocked.venteManuelle.aggregate
      .mockResolvedValueOnce({ _sum: { montant: 800 } })  // N1 YTD
      .mockResolvedValueOnce({ _sum: { montant: 1500 } }) // N1 total
    mocked.facture.findMany
      .mockResolvedValueOnce([
        { id: 1, type: 'facture', totalTTC: 500, factureOrigineId: null, lignes: [], _count: {} },
        { id: 2, type: 'avoir', totalTTC: 100, factureOrigineId: 1, lignes: [], _count: {} }, // soustrait
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
    mocked.venteManuelle.findMany.mockResolvedValueOnce([{ montant: 100, module: null, categorie: 'autre' }])
    mocked.venteManuelle.aggregate
      .mockResolvedValueOnce({ _sum: { montant: 50 } })
      .mockResolvedValueOnce({ _sum: { montant: 300 } })

    const kpi = await getKpiCompta('user-4', 2026, new Date('2026-05-14'))

    expect(kpi.revenusN1Ytd).toBe(50)
    expect(kpi.revenusN1Total).toBe(300)
    // Une variation honnête doit utiliser N1Ytd (50), donnant +100 %.
    // L'UI ne doit JAMAIS comparer 100 à 300 quand on est en mai.
  })

  it('ventile les revenus YTD par module sur les mêmes lignes : Σ modules = revenusYtd (ticket cmvflua2x)', async () => {
    mocked.venteManuelle.findMany.mockResolvedValueOnce([
      { montant: 300, module: 'potager', categorie: 'legumes' },
      { montant: 120.5, module: 'elevage', categorie: 'oeufs' },
      { montant: 45.25, module: 'boutique', categorie: 'autre' },
    ])
    mocked.facture.findMany.mockImplementation(async (args: { where: { id?: unknown; date?: { gte: Date } } }) => {
      // Facture d'origine d'un avoir, chargée à part (exercice antérieur).
      if (args.where.id) return [{ id: 7, lignes: [], _count: { ventesProduits: 1 } }]
      // Exercice N-1 : rien.
      if (args.where.date && args.where.date.gte.getFullYear() === 2025) return []
      return [
        { id: 11, type: 'facture', totalTTC: 211.1, factureOrigineId: null, lignes: [], _count: { ventesProduits: 1 } },
        { id: 12, type: 'facture', totalTTC: 165.5, factureOrigineId: null, lignes: [], _count: {} }, // saisie sans vente
        { id: 13, type: 'facture', totalTTC: 50, factureOrigineId: null, lignes: [], _count: {} }, // récolte du potager facturée
        { id: 14, type: 'avoir', totalTTC: 37.4, factureOrigineId: 7, lignes: [], _count: {} },
      ]
    })
    mocked.recolte.findMany.mockResolvedValueOnce([{ factureId: 13 }])

    const kpi = await getKpiCompta('user-ventilation', 2026, new Date('2026-10-19T12:00:00'))
    const v = kpi.revenusParModuleYtd

    expect(kpi.revenusYtd).toBe(854.95) // 465.75 + 211.1 + 165.5 + 50 − 37.4
    expect(v.parModule).toEqual({ potager: 350, verger: 0, elevage: 294.2, autre: 210.75 })
    const sommeModules = Math.round(Object.values(v.parModule).reduce((s, x) => s + x, 0) * 100) / 100
    expect(sommeModules).toBe(kpi.revenusYtd)
    expect(v.composition).toEqual({ ventes: 465.75, facturesRattachees: 261.1, facturesSansVente: 165.5, avoirs: -37.4 })
    // Même périmètre que le total : factures ni brouillon ni annulées, bornées au jour.
    const premier = mocked.facture.findMany.mock.calls[0][0]
    expect(premier.where.statut).toEqual({ notIn: ['annulee', 'brouillon'] })
    expect(premier.where.date.lte).toEqual(new Date('2026-10-19T12:00:00'))
  })

  it('mémoïse : deuxième appel ne refait pas les agrégations', async () => {
    await getKpiCompta('user-mem', 2026, new Date('2026-05-14'))
    const facturesCalls = mocked.facture.findMany.mock.calls.length
    await getKpiCompta('user-mem', 2026, new Date('2026-05-14'))
    expect(mocked.facture.findMany.mock.calls.length).toBe(facturesCalls)
  })
})
