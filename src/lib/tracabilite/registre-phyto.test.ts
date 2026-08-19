/**
 * QA cmsoghh2b — genererRegistrePhyto (SSOT écran Traçabilité + outil
 * assistant get_registre_phyto) agrégeait Intervention + ObservationSante
 * mais jamais operations_arbres, alors que le registre verger (SanteTab)
 * les affiche : la « Bouillie bordelaise 3 kg » d'un arbre manquait au
 * registre global.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  interventionFindMany: vi.fn(),
  observationFindMany: vi.fn(),
  operationFindMany: vi.fn(),
  cultureFindUnique: vi.fn(),
  plancheFindUnique: vi.fn(),
  arbreFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    intervention: { findMany: mocks.interventionFindMany },
    observationSante: { findMany: mocks.observationFindMany },
    operationArbre: { findMany: mocks.operationFindMany },
    culture: { findUnique: mocks.cultureFindUnique },
    planche: { findUnique: mocks.plancheFindUnique },
    arbre: { findUnique: mocks.arbreFindUnique },
  },
}))

import { genererRegistrePhyto } from './registre-phyto'

const user = { name: 'Marc', email: 'marc@example.com' }

function fakeIntervention(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    date: new Date('2026-04-10T08:00:00.000Z'),
    cultureId: null,
    plancheId: null,
    arbreId: null,
    produitPhyto: 'Savon noir',
    produitPhytoRef: null,
    numAMM: null,
    cibleTraitement: 'Pucerons',
    doseAppliquee: 2,
    uniteDose: 'L/ha',
    surfaceTraitee: 100,
    volumeBouillieLHa: null,
    temperatureC: null,
    ventKmh: null,
    hygrometriePct: null,
    dar: 3,
    delaiReentree: null,
    zntDistanceM: null,
    zntRespectee: null,
    conditionsMeteo: null,
    certiphytoNum: null,
    certiphytoValidite: null,
    justification: null,
    observationLieeId: null,
    intrantNumLot: null,
    notes: null,
    description: null,
    user,
    operateur: null,
    ...overrides,
  }
}

function fakeOperation(overrides: Record<string, unknown> = {}) {
  return {
    id: 938,
    date: new Date('2026-05-02T09:00:00.000Z'),
    produit: 'Bouillie bordelaise',
    description: 'Traitement préventif tavelure',
    quantite: 3,
    unite: 'kg',
    notes: null,
    temperatureC: null,
    ventKmh: null,
    hygrometriePct: null,
    arbre: { nom: 'Pommier Reinette', espece: 'Pommier', variete: null },
    user,
    operateur: null,
    ...overrides,
  }
}

describe('genererRegistrePhyto — 3ᵉ source operations_arbres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.interventionFindMany.mockResolvedValue([])
    mocks.observationFindMany.mockResolvedValue([])
    mocks.operationFindMany.mockResolvedValue([])
  })

  it("inclut une opération d'arbre type traitement au format écran (SanteTab)", async () => {
    mocks.operationFindMany.mockResolvedValue([fakeOperation()])

    const { registre, stats } = await genererRegistrePhyto('user-1', 2026)

    expect(mocks.operationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          type: 'traitement',
          fait: true,
          OR: [{ produit: { not: null } }, { description: { not: null } }],
        }),
      })
    )
    expect(registre).toHaveLength(1)
    const ligne = registre[0]
    expect(ligne.id).toBe(2_000_000_938) // id sans collision avec interventions/observations
    expect(ligne.produit).toBe('Bouillie bordelaise')
    expect(ligne.doseAppliquee).toBe(3)
    expect(ligne.uniteDose).toBe('kg')
    expect(ligne.culture).toBe('Pommier Reinette')
    expect(ligne.espece).toBe('Pommier')
    expect(ligne.numAMM).toBeNull() // champ absent du modèle OperationArbre
    expect(ligne.dar).toBeNull()
    expect(ligne.classification).toBe('Autorisé AB') // heuristique bouillie/cuivre
    expect(ligne.description).toBe('Traitement préventif tavelure')
    expect(stats.totalTraitements).toBe(1)
    expect(stats.produitsUtilises).toContain('Bouillie bordelaise')
  })

  it('fusionne les trois sources triées par date, sans collision d’ids', async () => {
    mocks.interventionFindMany.mockResolvedValue([fakeIntervention({ id: 5 })])
    mocks.observationFindMany.mockResolvedValue([
      {
        id: 5,
        date: new Date('2026-06-01T08:00:00.000Z'),
        produit: 'Purin d’ortie',
        numAMM: null,
        doseAppliquee: 1,
        uniteDose: 'L/ha',
        volumeBouillieLHa: null,
        temperatureC: null,
        ventKmh: null,
        hygrometriePct: null,
        dar: null,
        diagnostic: 'Pucerons',
        symptome: null,
        traitement: null,
        certiphytoNum: null,
        arbre: { nom: 'Poirier', espece: 'Poirier', variete: null },
        parcelle: null,
        operateur: null,
        user,
      },
    ])
    mocks.operationFindMany.mockResolvedValue([fakeOperation({ id: 5 })])

    const { registre, stats } = await genererRegistrePhyto('user-1', 2026)

    expect(registre.map((e) => e.id)).toEqual([5, 2_000_000_005, 1_000_000_005])
    expect(new Set(registre.map((e) => e.id)).size).toBe(3)
    // Tri chronologique : intervention (04-10) < opération (05-02) < observation (06-01)
    expect(registre.map((e) => e.date)).toEqual(
      [...registre.map((e) => e.date)].sort()
    )
    expect(stats.totalTraitements).toBe(3)
  })
})
