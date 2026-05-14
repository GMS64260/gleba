/**
 * BUG-14 — tests : `getStatsPlanification` compte les variétés DISTINCT
 * et n'inclut pas les ITPs comme cultures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    planche: { findMany: vi.fn().mockResolvedValue([]) },
    espece: { findMany: vi.fn().mockResolvedValue([]) },
    culture: { findMany: vi.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { getStatsPlanification } from '../planification'

const mocked = prisma as unknown as {
  planche: { findMany: ReturnType<typeof vi.fn> }
  espece: { findMany: ReturnType<typeof vi.fn> }
  culture: { findMany: ReturnType<typeof vi.fn> }
}

describe('getStatsPlanification (BUG-14 variétés DISTINCT)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.planche.findMany.mockResolvedValue([])
    mocked.espece.findMany.mockResolvedValue([])
    mocked.culture.findMany.mockResolvedValue([])
  })

  it('renvoie nbVarietes=0 quand aucune culture', async () => {
    const stats = await getStatsPlanification('u1', 2026)
    expect(stats.nbVarietes).toBe(0)
    expect(stats.nbEspecesAvecVariete).toBe(0)
  })

  it('dédoublonne les variétés (DISTINCT, pas COUNT)', async () => {
    // Prisma distinct: ['varieteId'] est mocké → on lui donne directement
    // la liste DISTINCT attendue (le test vérifie la propagation, pas
    // le moteur SQL).
    mocked.culture.findMany.mockResolvedValue([
      { varieteId: 'rouge_de_treves', especeId: 'tomate' },
      { varieteId: 'gariguette', especeId: 'fraisier' },
      { varieteId: 'mara_des_bois', especeId: 'fraisier' },
      { varieteId: 'flageolet', especeId: 'haricot' },
    ])
    const stats = await getStatsPlanification('u1', 2026)
    expect(stats.nbVarietes).toBe(4) // 4 variétés distinctes
    expect(stats.nbEspecesAvecVariete).toBe(3) // 3 espèces qui ont au moins une variété
  })

  it('ne compte pas les variétés null (cultures sans variété choisie)', async () => {
    // Prisma applique `where: { varieteId: { not: null } }` — on mocke
    // donc une liste qui n'a déjà QUE des varieteId non-null.
    mocked.culture.findMany.mockResolvedValue([
      { varieteId: 'gariguette', especeId: 'fraisier' },
    ])
    const stats = await getStatsPlanification('u1', 2026)
    expect(stats.nbVarietes).toBe(1)
  })

  it("appelle prisma.culture.findMany avec distinct=['varieteId'] et varieteId non-null", async () => {
    await getStatsPlanification('u1', 2026)
    expect(mocked.culture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', annee: 2026, varieteId: { not: null } },
        distinct: ['varieteId'],
      })
    )
  })
})
