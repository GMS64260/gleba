import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearKpiCache } from '../cache'

// On mock le client Prisma au niveau du module pour exercer la logique du
// helper sans toucher la BDD.
vi.mock('@/lib/prisma', () => {
  return {
    default: {
      culture: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      recolte: {
        aggregate: vi.fn(),
      },
      planche: {
        aggregate: vi.fn(),
      },
    },
  }
})

import prisma from '@/lib/prisma'
import { getKpiMaraichage } from '../maraichage'

type AnyMock = ReturnType<typeof vi.fn>

const mocked = prisma as unknown as {
  culture: { findMany: AnyMock; count: AnyMock }
  recolte: { aggregate: AnyMock }
  planche: { aggregate: AnyMock }
}

function setupDefaults() {
  mocked.culture.findMany.mockResolvedValue([])
  mocked.culture.count.mockResolvedValue(0)
  mocked.recolte.aggregate.mockResolvedValue({ _sum: { quantite: 0 } })
  mocked.planche.aggregate.mockResolvedValue({
    _sum: { surface: 0 },
    _count: { _all: 0 },
  })
}

describe('getKpiMaraichage', () => {
  beforeEach(() => {
    clearKpiCache()
    vi.clearAllMocks()
    setupDefaults()
  })

  it('expose des surfaces cultivée < planifiée quand des cultures sont seulement planifiées', async () => {
    mocked.culture.findMany.mockResolvedValue([
      // P1 : culture active (semée) → comptée des deux côtés
      {
        id: 1,
        plancheId: 'p1',
        semisFait: true,
        plantationFaite: false,
        recolteFaite: false,
        terminee: null,
        planche: { surface: 100 },
      },
      // P2 : culture planifiée non semée → comptée en "planifiée" seulement
      {
        id: 2,
        plancheId: 'p2',
        semisFait: false,
        plantationFaite: false,
        recolteFaite: false,
        terminee: null,
        planche: { surface: 50 },
      },
      // P3 : culture terminée → ni cultivée ni encore "active"
      {
        id: 3,
        plancheId: 'p3',
        semisFait: true,
        plantationFaite: true,
        recolteFaite: true,
        terminee: 'x',
        planche: { surface: 20 },
      },
    ])
    mocked.culture.count.mockResolvedValue(1) // P1 seule

    const kpi = await getKpiMaraichage('user-1', 2026, new Date('2026-05-14'))

    expect(kpi.surfaceCultiveeM2).toBe(100)
    expect(kpi.surfacePlanifieeM2).toBe(170) // 100 + 50 + 20
    expect(kpi.culturesActives).toBe(1)
    expect(kpi.culturesPlanifiees).toBe(3)
  })

  it('compare les récoltes YTD vs YTD N-1 (pas vs année N-1 complète)', async () => {
    // Une aggregate par appel : YTD, N1 YTD, N1 total, planches.
    mocked.recolte.aggregate
      .mockResolvedValueOnce({ _sum: { quantite: 58.5 } })   // YTD 2026
      .mockResolvedValueOnce({ _sum: { quantite: 120.0 } })  // YTD 2025 à mi-mai
      .mockResolvedValueOnce({ _sum: { quantite: 600.0 } })  // 2025 total

    const kpi = await getKpiMaraichage('user-1', 2026, new Date('2026-05-14'))

    expect(kpi.recoltesKgYtd).toBe(58.5)
    expect(kpi.recoltesKgN1Ytd).toBe(120.0)
    expect(kpi.recoltesKgN1Total).toBe(600.0)
    // La variation calculée par l'UI doit utiliser recoltesKgN1Ytd, jamais
    // recoltesKgN1Total — on s'assure que la couche ne supprime PAS l'info
    // brute mais expose les deux explicitement.
  })

  it('reste robuste sur année charnière (asOf en début janvier)', async () => {
    mocked.recolte.aggregate
      .mockResolvedValueOnce({ _sum: { quantite: 0.0 } })
      .mockResolvedValueOnce({ _sum: { quantite: 0.0 } })
      .mockResolvedValueOnce({ _sum: { quantite: 500.0 } })

    const kpi = await getKpiMaraichage('user-2', 2026, new Date('2026-01-01'))

    expect(kpi.recoltesKgYtd).toBe(0)
    expect(kpi.recoltesKgN1Ytd).toBe(0) // pas de "année dernière complète"
    expect(kpi.recoltesKgN1Total).toBe(500)
  })

  it("dédoublonne la surface si une même planche porte plusieurs cultures dans l'année", async () => {
    // Succession sur la même planche → la surface ne doit pas être comptée 2x.
    mocked.culture.findMany.mockResolvedValue([
      {
        id: 1,
        plancheId: 'p1',
        semisFait: true,
        plantationFaite: false,
        recolteFaite: false,
        terminee: 'x',
        planche: { surface: 50 },
      },
      {
        id: 2,
        plancheId: 'p1',
        semisFait: true,
        plantationFaite: true,
        recolteFaite: false,
        terminee: null,
        planche: { surface: 50 },
      },
    ])
    mocked.culture.count.mockResolvedValue(1)

    const kpi = await getKpiMaraichage('user-3', 2026, new Date('2026-06-01'))

    expect(kpi.surfacePlanifieeM2).toBe(50)
    expect(kpi.surfaceCultiveeM2).toBe(50)
  })

  it('mémoïse le calcul (deuxième appel = 0 requête supplémentaire)', async () => {
    await getKpiMaraichage('user-mem', 2026, new Date('2026-05-14'))
    const callsAfterFirst = mocked.recolte.aggregate.mock.calls.length

    await getKpiMaraichage('user-mem', 2026, new Date('2026-05-14'))
    expect(mocked.recolte.aggregate.mock.calls.length).toBe(callsAfterFirst)
  })
})
