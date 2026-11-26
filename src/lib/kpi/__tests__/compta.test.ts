import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearKpiCache } from '../cache'

// Ces tests isolent les calculs de CA. Les restes à payer et leur intégration
// aux indicateurs sont vérifiés sur PostgreSQL dans reglements.integration.
const encours = vi.hoisted(() => ({ dettes: { total: 0, nombre: 0, items: [] as Array<{ id: number; montant: number; monnaie?: string | null }> } }))
vi.mock('@/lib/comptabilite/encours', () => ({ chargerEncoursCompta: vi.fn(async () => ({ creances: { items: [], total: 0 }, dettes: encours.dettes })) }))

vi.mock('@/lib/prisma', () => {
  return {
    default: {
      exploitation: { findUnique: vi.fn() },
      venteManuelle: { aggregate: vi.fn(), findMany: vi.fn() },
      depenseManuelle: { findMany: vi.fn() },
      cibleReglement: { findMany: vi.fn() },
      facture: { findMany: vi.fn() },
      recolte: { findMany: vi.fn() },
    },
  }
})

import prisma from '@/lib/prisma'
import { getKpiCompta } from '../compta'

type AnyMock = ReturnType<typeof vi.fn>
const mocked = prisma as unknown as {
  exploitation: { findUnique: AnyMock }
  venteManuelle: { aggregate: AnyMock; findMany: AnyMock }
  depenseManuelle: { findMany: AnyMock }
  cibleReglement: { findMany: AnyMock }
  facture: { findMany: AnyMock }
  recolte: { findMany: AnyMock }
}

/** Dépense comptable fictive de l'exercice 2026. */
const depense = (id: number, montant: number) => ({
  id, auto: false, sourceType: null, sourceId: null, sourceRef: null, date: new Date('2026-03-01'), montant, categorie: 'materiel', module: null,
})

describe('getKpiCompta', () => {
  beforeEach(() => {
    clearKpiCache()
    vi.clearAllMocks()
    mocked.exploitation.findUnique.mockResolvedValue({ devise: 'EUR', territoire: 'METROPOLE' })
    mocked.venteManuelle.aggregate.mockResolvedValue({ _sum: { montant: 0 } })
    mocked.venteManuelle.findMany.mockResolvedValue([])
    mocked.depenseManuelle.findMany.mockResolvedValue([])
    mocked.cibleReglement.findMany.mockResolvedValue([])
    encours.dettes = { total: 0, nombre: 0, items: [] }
    mocked.facture.findMany.mockResolvedValue([])
    mocked.recolte.findMany.mockResolvedValue([])
  })

  it('somme VenteManuelle + LigneFacture (factures non annulées) pour les revenus', async () => {
    // YTD et N-1 : lignes (N-1 lu sur l'année entière, YTD N-1 filtré au même jour).
    const n1 = (q: { where: { date: { gte: Date } } }) => q.where.date.gte.getFullYear() === 2025
    mocked.venteManuelle.findMany.mockImplementation(async (q: { where: { date: { gte: Date } } }) => n1(q)
      ? [{ date: new Date('2025-03-01'), montant: 800 }, { date: new Date('2025-09-01'), montant: 700 }]
      : [{ montant: 1000, module: 'potager', categorie: 'legumes' }])
    mocked.facture.findMany.mockImplementation(async (q: { where: { date: { gte: Date } } }) => n1(q) ? [] : [
      { id: 1, type: 'facture', totalTTC: 500, factureOrigineId: null, date: new Date('2026-02-01'), emetteurSnapshot: { devise: 'EUR' }, lignes: [], _count: {} },
      { id: 2, type: 'avoir', totalTTC: 100, factureOrigineId: 1, date: new Date('2026-02-02'), emetteurSnapshot: { devise: 'EUR' }, lignes: [], _count: {} }, // soustrait
    ])

    const kpi = await getKpiCompta('user-1', 2026, new Date('2026-05-14'))

    expect(kpi.revenusYtd).toBe(1400) // 1000 + (500 - 100)
    expect(kpi.revenusN1Ytd).toBe(800)
    expect(kpi.revenusN1Total).toBe(1500)
    expect(kpi.revenusYtdParDevise).toEqual([expect.objectContaining({ monnaie: 'EUR', total: 1400, count: 3 })])
    expect(kpi.revenusN1YtdParDevise).toEqual([{ monnaie: 'EUR', total: 800, count: 1 }])
  })

  it('ventile par devise (lot devise-totaux-api) : facture EUR figée sur une ferme passée en XPF, dépenses en devise courante', async () => {
    mocked.exploitation.findUnique.mockResolvedValue({ devise: 'XPF', territoire: 'NOUVELLE_CALEDONIE' })
    mocked.venteManuelle.findMany.mockImplementation(async (q: { where: { date: { gte: Date } } }) =>
      q.where.date.gte.getFullYear() === 2026 ? [{ montant: 3000, module: 'potager', categorie: 'legumes' }] : [])
    mocked.facture.findMany.mockImplementation(async (q: { where: { date: { gte: Date } } }) =>
      q.where.date.gte.getFullYear() === 2026
        ? [{ id: 9, type: 'facture', totalTTC: 105.5, factureOrigineId: null, date: new Date('2026-08-01'), emetteurSnapshot: { devise: 'EUR' }, lignes: [], _count: {} }]
        : [])
    mocked.depenseManuelle.findMany.mockResolvedValue([depense(1, 500)])

    const kpi = await getKpiCompta('user-devises', 2026, new Date('2026-11-16'), { parDevise: true })

    await expect(getKpiCompta('user-devises', 2026, new Date('2026-11-16'))).rejects.toMatchObject({ status: 422 })
    expect(kpi.revenusYtd).toBeNull()
    expect(kpi.beneficeYtd).toBeNull()
    expect(kpi.margePercentYtd).toBeNull()
    expect(kpi.revenusParModuleYtd).toBeNull()
    expect(kpi.deviseCourante).toBe('XPF')
    expect(kpi.revenusYtdParDevise.map(g => [g.monnaie, g.total])).toEqual([['EUR', 105.5], ['XPF', 3000]])
    expect(kpi.depensesYtdParDevise).toEqual([{ monnaie: 'XPF', total: 500, count: 1 }])
    expect(kpi.beneficeYtdParDevise).toEqual([{ monnaie: 'EUR', total: 105.5 }, { monnaie: 'XPF', total: 2500 }])
  })

  it('tour 2 : une dépense réglée garde la devise de son dossier de règlement, charge et dette comprises', async () => {
    mocked.exploitation.findUnique.mockResolvedValue({ devise: 'XPF', territoire: 'NOUVELLE_CALEDONIE' })
    mocked.depenseManuelle.findMany.mockResolvedValue([depense(8, 100), depense(9, 4000)])
    mocked.cibleReglement.findMany.mockResolvedValue([{ cle: 'depense:manuel:8', dossier: { devise: 'EUR' } }])
    encours.dettes = { total: 4080, nombre: 2, items: [{ id: 8, montant: 80, monnaie: 'EUR' }, { id: 9, montant: 4000, monnaie: 'XPF' }] }

    const kpi = await getKpiCompta('user-dossier', 2026, new Date('2026-11-16'), { parDevise: true })

    expect(mocked.cibleReglement.findMany.mock.calls[0][0].where).toEqual({
      userId: 'user-dossier', cle: { in: ['depense:manuel:8', 'depense:manuel:9'] }, dossier: { userId: 'user-dossier' },
    })
    expect(kpi.depensesYtdParDevise).toEqual([{ monnaie: 'EUR', total: 100, count: 1 }, { monnaie: 'XPF', total: 4000, count: 1 }])
    expect(kpi.depensesNonPayeesYtdParDevise.map(t => [t.monnaie, t.total])).toEqual([['EUR', 80], ['XPF', 4000]])
    expect(kpi.beneficeYtdParDevise).toEqual([{ monnaie: 'EUR', total: -100 }, { monnaie: 'XPF', total: -4000 }])
  })

  it('une dette dont la devise est inconnue reste inconnue, sans repli XPF', async () => {
    mocked.exploitation.findUnique.mockResolvedValue({ devise: 'XPF', territoire: 'NOUVELLE_CALEDONIE' })
    encours.dettes = { total: 80, nombre: 1, items: [{ id: 8, montant: 80, monnaie: null }] }
    const kpi = await getKpiCompta('user-devise-inconnue', 2026, new Date('2026-11-16'), { parDevise: true })
    expect(kpi.depensesNonPayeesYtdParDevise).toEqual([{ monnaie: null, total: 80, count: 1 }])
  })

  it("calcule bénéfice et marge à 0 quand aucun revenu n'est saisi", async () => {
    mocked.depenseManuelle.findMany.mockResolvedValue([depense(2, 250)])

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
    mocked.venteManuelle.findMany.mockImplementation(async (q: { where: { date: { gte: Date } } }) =>
      q.where.date.gte.getFullYear() === 2025
        ? [{ date: new Date('2025-04-01'), montant: 50 }, { date: new Date('2025-10-01'), montant: 250 }]
        : [{ montant: 100, module: null, categorie: 'autre' }])

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
        { id: 11, type: 'facture', emetteurSnapshot: { devise: 'EUR' }, totalTTC: 211.1, factureOrigineId: null, lignes: [], _count: { ventesProduits: 1 } },
        { id: 12, type: 'facture', emetteurSnapshot: { devise: 'EUR' }, totalTTC: 165.5, factureOrigineId: null, lignes: [], _count: {} }, // saisie sans vente
        { id: 13, type: 'facture', emetteurSnapshot: { devise: 'EUR' }, totalTTC: 50, factureOrigineId: null, lignes: [], _count: {} }, // récolte du potager facturée
        { id: 14, type: 'avoir', emetteurSnapshot: { devise: 'EUR' }, totalTTC: 37.4, factureOrigineId: 7, lignes: [], _count: {} },
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
    // Au soir du jour, pas à l'instant : un avoir daté du jour (minuit UTC) est compté (D70).
    expect(premier.where.date.lte).toEqual(new Date(2026, 9, 19, 23, 59, 59, 999))
  })

  it('un changement de devise courante ne réutilise pas les agrégats mis en cache avant le changement', async () => {
    mocked.venteManuelle.findMany.mockImplementation(async (q: { where: { date: { gte: Date } } }) =>
      q.where.date.gte.getFullYear() === 2026 ? [{ montant: 100, module: 'potager', categorie: 'legumes' }] : [])
    const date = new Date('2026-11-16')
    expect((await getKpiCompta('user-cache-devise', 2026, date, { parDevise: true })).revenusYtdParDevise[0].monnaie).toBe('EUR')
    mocked.exploitation.findUnique.mockResolvedValue({ devise: 'XPF', territoire: 'NOUVELLE_CALEDONIE' })
    const apres = await getKpiCompta('user-cache-devise', 2026, date, { parDevise: true })
    expect(apres.deviseCourante).toBe('XPF')
    expect(apres.revenusYtdParDevise).toEqual([expect.objectContaining({ monnaie: 'XPF', total: 100 })])
  })

  it('mémoïse : deuxième appel ne refait pas les agrégations', async () => {
    await getKpiCompta('user-mem', 2026, new Date('2026-05-14'))
    const facturesCalls = mocked.facture.findMany.mock.calls.length
    await getKpiCompta('user-mem', 2026, new Date('2026-05-14'))
    expect(mocked.facture.findMany.mock.calls.length).toBe(facturesCalls)
  })
})
