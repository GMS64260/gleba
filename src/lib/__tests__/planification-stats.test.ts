/**
 * BUG-14 — tests : `getStatsPlanification` compte les variétés DISTINCT
 * et n'inclut pas les ITPs comme cultures.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const terroirMocks = vi.hoisted(() => ({
  zoneEffectiveUser: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    planche: { findMany: vi.fn().mockResolvedValue([]) },
    espece: { findMany: vi.fn().mockResolvedValue([]) },
    culture: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/terroir', () => ({
  zoneEffectiveUser: terroirMocks.zoneEffectiveUser,
}))

import prisma from '@/lib/prisma'
import { getCulturesPrevues, getStatsPlanification } from '../planification'

const mocked = prisma as unknown as {
  planche: { findMany: ReturnType<typeof vi.fn> }
  espece: { findMany: ReturnType<typeof vi.fn> }
  culture: { findMany: ReturnType<typeof vi.fn> }
}

const itpRotation = {
  especeId: 'courge',
  espece: { couleur: '#f59e0b' },
  semaineSemis: 16,
  semainePlantation: 20,
  semaineRecolte: 36,
  dureeCulture: 120,
  nbRangs: 2,
  espacement: 80,
  zoneClimat: null as string | null,
}

function plancheAvecCulture(culture: {
  id: number
  recolteFaite?: boolean
  terminee?: string | null
}) {
  return {
    id: 'planche-cuid-a2',
    nom: 'A2',
    longueur: 10,
    largeur: 1.2,
    surface: 12,
    ilot: 'A',
    rotationId: 'rotation-courges',
    annee: 2027,
    rotation: {
      nbAnnees: 1,
      details: [{
        annee: 1,
        itpId: 'itp-courge',
        itp: itpRotation,
      }],
    },
    cultures: [{
      id: culture.id,
      especeId: 'courge',
      varieteId: 'butternut',
      itpId: 'itp-courge',
      dateSemis: null,
      datePlantation: null,
      dateRecolte: null,
      recolteFaite: culture.recolteFaite ?? false,
      terminee: culture.terminee ?? null,
    }],
  }
}

function cultureDirecte(id: number) {
  return {
    id,
    plancheId: 'planche-cuid-a2',
    itpId: 'itp-courge',
    especeId: 'courge',
    varieteId: 'butternut',
    annee: 2027,
    dateSemis: null,
    datePlantation: null,
    dateRecolte: null,
    longueur: null,
    nbRangs: 2,
    espacement: 80,
    espece: { couleur: '#f59e0b', rendement: 3 },
    itp: itpRotation,
    planche: {
      id: 'planche-cuid-a2',
      nom: 'A2',
      longueur: 10,
      largeur: 1.2,
      surface: 12,
      ilot: 'A',
      rotationId: 'rotation-courges',
    },
    variete: { id: 'butternut' },
  }
}

describe('getCulturesPrevues (inventaire annuel)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.planche.findMany.mockResolvedValue([])
    mocked.espece.findMany.mockResolvedValue([])
    mocked.culture.findMany.mockResolvedValue([])
    terroirMocks.zoneEffectiveUser.mockResolvedValue(null)
  })

  it('dédoublonne une culture créée depuis une rotation malgré les deux formats de plancheId', async () => {
    mocked.planche.findMany.mockResolvedValue([plancheAvecCulture({ id: 856 })])
    mocked.culture.findMany.mockResolvedValue([cultureDirecte(856)])

    const cultures = await getCulturesPrevues('u1', 2027, {
      includeAllCultures: true,
    })

    expect(cultures).toHaveLength(1)
    expect(cultures[0]).toMatchObject({
      cultureId: 856,
      plancheId: 'A2',
      existante: true,
    })
  })

  it('conserve une culture en récolte dans l’inventaire mais pas dans les projections restantes', async () => {
    mocked.planche.findMany.mockResolvedValue([
      plancheAvecCulture({ id: 460, recolteFaite: true }),
    ])

    const inventaire = await getCulturesPrevues('u1', 2026, {
      includeAllCultures: true,
    })
    const projectionsRestantes = await getCulturesPrevues('u1', 2026)

    expect(inventaire).toHaveLength(1)
    expect(inventaire[0].cultureId).toBe(460)
    expect(projectionsRestantes).toHaveLength(0)
  })

  it('recalibre les semaines théoriques du climat source vers la ferme', async () => {
    terroirMocks.zoneEffectiveUser.mockResolvedValue('semi_continental')
    const planche = plancheAvecCulture({ id: 900 })
    planche.cultures = []
    planche.rotation.details[0].itp = {
      ...itpRotation,
      zoneClimat: 'oceanique',
    }
    mocked.planche.findMany.mockResolvedValue([planche])

    const cultures = await getCulturesPrevues('u1', 2027)

    expect(cultures[0]).toMatchObject({
      semaineSemis: 18,
      semainePlantation: 22,
      semaineRecolte: 38,
    })
  })

  it('utilise les semaines ISO des dates réelles et la portion cultivée', async () => {
    const culture = cultureDirecte(862)
    culture.longueur = 10
    culture.nbRangs = 3
    culture.espacement = 11
    culture.dateSemis = new Date('2027-03-21T23:00:00.000Z')
    culture.dateRecolte = new Date('2027-05-16T22:00:00.000Z')
    culture.planche.longueur = 15
    culture.planche.surface = 18
    mocked.culture.findMany.mockResolvedValue([culture])

    const [prevue] = await getCulturesPrevues('u1', 2027)

    expect(prevue).toMatchObject({
      semaineSemis: 12,
      semaineRecolte: 20,
      surface: 12,
      cultureLongueur: 10,
    })
  })
})

describe('getStatsPlanification (BUG-14 variétés DISTINCT)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.planche.findMany.mockResolvedValue([])
    mocked.espece.findMany.mockResolvedValue([])
    mocked.culture.findMany.mockResolvedValue([])
    terroirMocks.zoneEffectiveUser.mockResolvedValue(null)
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
    // Bug R6 : les variétés placeholder (« Non spécifiée ») sont exclues.
    expect(mocked.culture.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'u1',
          annee: 2026,
          varieteId: { not: null },
          variete: { isPlaceholder: false },
        },
        distinct: ['varieteId'],
      })
    )
  })
})
