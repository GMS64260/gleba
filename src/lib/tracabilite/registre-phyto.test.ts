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

  // QA cmv2962ey — une AMM « ABC » passait au registre sans badge.
  it("signale « Non conforme » une AMM qui n'a pas sept chiffres, et accepte 7 chiffres", async () => {
    mocks.interventionFindMany.mockResolvedValue([
      fakeIntervention({ id: 1, numAMM: 'ABC' }),
      fakeIntervention({ id: 2, numAMM: '2100123' }),
      fakeIntervention({ id: 3, numAMM: null }),
      // Référentiel produit : son AMM prime sur la saisie libre.
      fakeIntervention({ id: 4, numAMM: 'ABC', produitPhytoRef: { id: 'p1', nomCommercial: 'Produit X', amm: '9800203', classification: 'Chimique conventionnel', autoriseAB: false, substanceActive: null, darJours: 3 } }),
    ])

    const { registre, stats } = await genererRegistrePhyto('user-1', 2026)
    const parId = new Map(registre.map((e) => [e.id, e]))

    expect(parId.get(1)?.champsManquants).toContain('numAMM invalide')
    expect(parId.get(1)?.complet).toBe(false)
    expect(parId.get(2)?.champsManquants).not.toContain('numAMM')
    expect(parId.get(2)?.champsManquants).not.toContain('numAMM invalide')
    expect(parId.get(3)?.champsManquants).toContain('numAMM')
    expect(parId.get(4)?.numAMM).toBe('9800203')
    expect(parId.get(4)?.champsManquants).not.toContain('numAMM invalide')
    // Les quatre fiches restent sans culture ni parcelle : toutes incomplètes
    // pour cette raison-là, l'AMM n'en ajoute ni n'en retire.
    expect(stats.nbIncomplets).toBe(4)
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

/**
 * QA cmvgeltj1 (2026-10-20) — traitement saisi depuis Verger > Santé & Phyto >
 * Registre phyto (ligne `observations_sante` relue en base : surface 0,01 ha,
 * ZNT 20 m respectée, 15 °C / vent 5 / hygro 70 / sans pluie, opérateur dans
 * les notes) : le registre général affichait Surface « Manquant », ZNT « - »,
 * Météo « - » et le nom de l'exploitation pour applicateur.
 */
describe('genererRegistrePhyto — traitement du registre Verger (observation santé)', () => {
  const compte = { name: 'Ferme test', email: 'ferme@example.test' }

  function fakeObservationVerger(overrides: Record<string, unknown> = {}) {
    return {
      id: 70,
      date: new Date('2026-10-20T00:00:00.000Z'),
      type: 'ravageur',
      methodeTraitement: 'chimique_conventionnel',
      produit: 'v8 produit fictif',
      numAMM: '9999999',
      doseAppliquee: 0.5,
      uniteDose: 'L/ha',
      dar: 7,
      surfaceTraiteeHa: 0.01,
      volumeBouillieLHa: 500,
      volumeBouillieLTotal: 5,
      temperatureC: 15,
      ventKmh: 5,
      hygrometriePct: 70,
      pluie24h: false,
      pluie24hMm: null,
      epiPortes: ['gants'],
      zntRespectee: true,
      zntDistanceM: 20,
      certiphytoNum: 'TEST-1',
      operateurId: null,
      notes: 'Opérateur : v8-Hélène',
      diagnostic: null,
      symptome: null,
      traitement: null,
      arbre: { nom: 'v8 prunier (5)', espece: 'Prunier', variete: null },
      parcelle: { nom: 'Demo-V' },
      operateur: null,
      user: compte,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.interventionFindMany.mockResolvedValue([])
    mocks.observationFindMany.mockResolvedValue([])
    mocks.operationFindMany.mockResolvedValue([])
  })

  it('projette surface (m²), ZNT, météo et opérateur saisis', async () => {
    mocks.observationFindMany.mockResolvedValue([fakeObservationVerger()])

    const { registre, stats } = await genererRegistrePhyto('user-1', 2026)
    const ligne = registre[0]

    expect(ligne.surfaceTraitee).toBe(100)
    expect(ligne.zntDistanceM).toBe(20)
    expect(ligne.zntRespectee).toBe(true)
    expect(ligne.conditionsMeteo).toBe('15 °C · vent 5 km/h · hygrométrie 70 % · sans pluie ±24 h')
    expect(ligne.applicateur).toBe('v8-Hélène')
    expect(ligne.operateurNom).toBe('v8-Hélène')
    // Déjà repris avant le correctif : inchangé.
    expect(ligne).toMatchObject({ culture: 'v8 prunier (5)', parcelle: 'Demo-V', numAMM: '9999999', doseAppliquee: 0.5, dar: 7 })
    expect(ligne.champsManquants).toEqual([])
    expect(ligne.complet).toBe(true)
    expect(stats.surfaceTotalTraitee).toBe(100)
  })

  it('méthode chimique : même exigence que la saisie, surface et DAR absents sont manquants', async () => {
    mocks.observationFindMany.mockResolvedValue([fakeObservationVerger({ surfaceTraiteeHa: null, dar: null })])

    const { registre } = await genererRegistrePhyto('user-1', 2026)

    expect(registre[0].champsManquants).toEqual(['surfaceTraitee', 'dar'])
    expect(registre[0].complet).toBe(false)
  })

  it("revue : biocontrôle sans AMM, surface ni DAR reste conforme (la saisie ne les exige pas)", async () => {
    mocks.observationFindMany.mockResolvedValue([
      fakeObservationVerger({
        methodeTraitement: 'biocontrole',
        numAMM: null,
        surfaceTraiteeHa: null,
        dar: null,
        temperatureC: null,
        certiphytoNum: null,
        zntRespectee: null,
      }),
    ])

    const { registre } = await genererRegistrePhyto('user-1', 2026)

    expect(registre[0].champsManquants).toEqual([])
    expect(registre[0].complet).toBe(true)
  })

  it('une AMM saisie mal formée reste signalée, quelle que soit la méthode', async () => {
    mocks.observationFindMany.mockResolvedValue([fakeObservationVerger({ methodeTraitement: 'biocontrole', numAMM: 'ABC' })])

    const { registre } = await genererRegistrePhyto('user-1', 2026)

    expect(registre[0].champsManquants).toEqual(['numAMM invalide'])
  })

  it('intervention : météo structurée et opérateur relus aussi (trace détachée d’un arbre supprimé)', async () => {
    mocks.interventionFindMany.mockResolvedValue([
      fakeIntervention({
        surfaceTraitee: null,
        surfaceTraiteeHa: 0.01,
        temperatureC: 15,
        ventKmh: 5,
        hygrometriePct: 70,
        pluie24h: false,
        notes: '[Arbre supprimé : v8 prunier (Prunier)]\nOpérateur : v8-Hélène',
        user: compte,
      }),
    ])

    const { registre } = await genererRegistrePhyto('user-1', 2026)

    expect(registre[0].surfaceTraitee).toBe(100)
    expect(registre[0].conditionsMeteo).toContain('15 °C')
    expect(registre[0].applicateur).toBe('v8-Hélène')
  })
})
