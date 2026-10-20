/**
 * Revue 2026-10-20 — repli nbRangs/espacement des besoins en semences et en
 * plants : l'ITP privé d'un autre compte prêtait ses rangs au calcul. Le repli
 * ne lit plus que les ITP visibles du compte (Gleba, partagés, les siens).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTRE, MOI, correspond, jeuReferentiel } from './fixtures/referentiel-memoire'

vi.mock('@/lib/prisma', () => ({
  default: {
    planche: { findMany: vi.fn().mockResolvedValue([]) },
    espece: { findMany: vi.fn().mockResolvedValue([]) },
    variete: { findMany: vi.fn().mockResolvedValue([]) },
    userStockVariete: { findMany: vi.fn().mockResolvedValue([]) },
    userStockEspece: { findMany: vi.fn().mockResolvedValue([]) },
    culture: { findMany: vi.fn() },
    iTP: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))
vi.mock('@/lib/terroir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terroir')>()
  return { ...actual, zoneEffectiveUser: vi.fn().mockResolvedValue(null) }
})

import prisma from '@/lib/prisma'
import { getBesoinsPlants, getBesoinsSemences } from '../planification'

const mocked = prisma as unknown as {
  culture: { findMany: ReturnType<typeof vi.fn> }
  iTP: { findMany: ReturnType<typeof vi.fn> }
}

/** Culture de tomates plantée, sans rangs ni espacement saisis : le repli s'applique. */
const culture = {
  id: 1,
  plancheId: 'B1',
  planche: { nom: 'B1', longueur: 10, largeur: 1, surface: 10, ilot: null, rotationId: null },
  itpId: null,
  itp: null,
  especeId: 'tomate',
  espece: { id: 'tomate', couleur: null, rendement: null },
  varieteId: null,
  variete: null,
  annee: 2026,
  dateSemis: null,
  datePlantation: new Date(2026, 4, 15),
  dateRecolte: null,
  nbRangs: null,
  espacement: null,
  longueur: null,
  quantite: null,
}

const itps = jeuReferentiel((id, nom) => ({ id: `i-${id}`, nom, especeId: 'tomate', nbRangs: 2, espacement: 40 }))

/** `where` des lectures de repli (celles qui sélectionnent nbRangs/espacement par espèce). */
const wheresRepli = () =>
  mocked.iTP.findMany.mock.calls
    .map(([args]) => args as { where: unknown; select?: Record<string, boolean> })
    .filter((args) => args.select?.especeId && args.select?.nbRangs)
    .map((args) => args.where)

beforeEach(() => {
  vi.clearAllMocks()
  mocked.culture.findMany.mockResolvedValue([culture])
})

describe('repli ITP des besoins — isolation entre comptes', () => {
  it.each([
    ['semences', () => getBesoinsSemences(MOI, 2026)],
    ['plants', () => getBesoinsPlants(MOI, 2026)],
  ])("besoins en %s : l'ITP privé d'un autre compte est exclu, Gleba et le compte restent", async (_nom, calculer) => {
    await calculer()
    const wheres = wheresRepli()
    expect(wheres.length).toBeGreaterThan(0)
    for (const where of wheres) {
      expect(correspond(itps.privee, where)).toBe(false)
      expect(correspond(itps.gleba, where)).toBe(true)
      expect(correspond(itps.moi, where)).toBe(true)
      expect(correspond(itps.partagee, where)).toBe(true)
    }
    expect(JSON.stringify(wheres)).not.toContain(AUTRE)
  })
})
