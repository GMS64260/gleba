/**
 * Revue du 2026-11-11 — calculs de la planification : surface de planche,
 * prorata des planches partagées, replis du référentiel, bornes des requêtes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  db: {} as Record<string, { findMany: ReturnType<typeof vi.fn> }>,
}))
vi.mock('@/lib/prisma', () => ({ default: m.db }))
vi.mock('@/lib/terroir', async (original) => ({
  ...(await original<typeof import('@/lib/terroir')>()),
  zoneEffectiveUser: vi.fn(async () => null),
}))

import {
  getBesoinsPlants,
  getBesoinsSemences,
  getCulturesPrevues,
  getCulturesPrevuesEtEtapesNonSuivies,
  getRecoltesPrevuesDetail,
} from '@/lib/planification'
import { defaultGrainesParGramme } from '@/lib/semences/calcul'

type Planche = {
  id: string
  nom: string
  largeur: number | null
  longueur: number | null
  surface: number | null
  ilot: string | null
  rotationId: string | null
  annee: number | null
}
const plancheP1: Planche = { id: 'p1', nom: 'P1', largeur: 1, longueur: 10, surface: 10, ilot: null, rotationId: null, annee: null }

function culture(extra: Record<string, unknown>) {
  return {
    id: 1,
    userId: 'moi',
    annee: 2026,
    especeId: 'Tomate',
    espece: { id: 'Tomate', couleur: null, rendement: 2 },
    varieteId: null,
    itpId: null,
    itp: null,
    plancheId: 'p1',
    planche: plancheP1,
    longueur: null,
    quantite: null,
    nbRangs: null,
    espacement: null,
    dateSemis: null,
    datePlantation: null,
    dateRecolte: null,
    recolteFaite: false,
    terminee: null,
    ...extra,
  }
}

const especesRef = [
  { id: 'Tomate', nom: 'Tomate', couleur: null, modeSemis: 'plant_repique', doseSemis: null, uniteDose: 'graines_plant', tauxGermination: null, margeSecuritePct: null, densite: null, famille: null, rendement: 2, uniteRendement: 'kg_m2' },
  { id: 'Ail', nom: 'Ail', couleur: null, modeSemis: 'bulbe_caieu', doseSemis: 10, uniteDose: 'caieux_m2', tauxGermination: null, margeSecuritePct: null, densite: null, famille: null, rendement: 1, uniteRendement: 'kg_m2' },
]

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(m.db, {
    planche: { findMany: vi.fn(async () => []) },
    culture: { findMany: vi.fn(async () => []) },
    espece: { findMany: vi.fn(async () => especesRef) },
    variete: { findMany: vi.fn(async () => []) },
    userStockVariete: { findMany: vi.fn(async () => []) },
    userStockEspece: { findMany: vi.fn(async () => []) },
    iTP: { findMany: vi.fn(async () => []) },
  })
})

describe('surface d’une culture : source unique `surfaceCultureM2`', () => {
  const plancheSurfaceSeule: Planche = { ...plancheP1, id: 'ps', nom: 'Serre', largeur: null, longueur: null, surface: 24 }

  it('une planche dont seule la surface est saisie n’est pas comptée à 0 m²', async () => {
    m.db.culture.findMany.mockResolvedValue([
      culture({ plancheId: 'ps', planche: plancheSurfaceSeule, dateRecolte: new Date('2026-07-01T00:00:00Z') }),
    ])

    const [prevue] = await getCulturesPrevues('moi', 2026)
    expect(prevue.surface).toBe(24)

    const detail = await getRecoltesPrevuesDetail('moi', 2026, 'mois')
    expect(detail.periodes[6].totalKg).toBe(48)
  })

  it('même règle pour une suggestion de rotation et pour une étape non suivie', async () => {
    const itp = { id: 'itp-t', especeId: 'Tomate', espece: { couleur: null }, userId: null, zoneClimat: null, semaineSemis: 10, semainePlantation: 18, semaineRecolte: 30, dureeCulture: 120, nbRangs: 1, espacement: 50 }
    const rotation = { nbAnnees: 1, details: [{ annee: 1, itpId: 'itp-t', itp }] }
    m.db.planche.findMany.mockResolvedValue([
      { ...plancheSurfaceSeule, rotationId: 'rot', annee: 2026, rotation, cultures: [] },
      {
        ...plancheSurfaceSeule,
        id: 'ps2',
        nom: 'Serre 2',
        rotationId: 'rot',
        annee: 2026,
        rotation,
        cultures: [{ id: 9, especeId: 'Ail', espece: { nom: 'Ail' }, varieteId: null, itpId: null, dateSemis: null, datePlantation: null, dateRecolte: null, longueur: null, quantite: null, nbRangs: null, espacement: null, recolteFaite: false, terminee: null }],
      },
    ])

    const { cultures, etapesNonSuivies } = await getCulturesPrevuesEtEtapesNonSuivies('moi', 2026)
    expect(cultures.find((c) => c.plancheId === 'Serre')?.surface).toBe(24)
    expect(etapesNonSuivies).toHaveLength(1)
    expect(etapesNonSuivies[0].surface).toBe(24)
  })

  it('la portion cultivée garde la priorité sur la surface de la planche', async () => {
    m.db.culture.findMany.mockResolvedValue([culture({ longueur: 4 })])
    const [prevue] = await getCulturesPrevues('moi', 2026)
    expect(prevue.surface).toBe(4)
  })
})

describe('prorata des planches partagées : même population sur Semences et Plants', () => {
  it('une culture reportée de l’an passé ne divise pas les plants de la culture de l’année', async () => {
    // Tomate 2026 sans quantité ni longueur propre : 1 rang × 10 m / 25 cm = 40 plants.
    const tomate = culture({ id: 1, nbRangs: 1, espacement: 25, datePlantation: new Date('2026-05-11T00:00:00Z') })
    // Ail planté à l'automne 2025, récolté en juin 2026, sur la même planche.
    const ail = culture({
      id: 2,
      annee: 2025,
      especeId: 'Ail',
      espece: { id: 'Ail', couleur: null, rendement: 1 },
      datePlantation: new Date('2025-10-13T00:00:00Z'),
      dateRecolte: new Date('2026-06-15T00:00:00Z'),
    })
    // Semences ne lit que l'année ; Plants demande aussi les reportées.
    m.db.culture.findMany.mockImplementation(async (args: { where: { OR?: unknown } }) =>
      args.where.OR ? [tomate, ail] : [tomate],
    )

    const semences = await getBesoinsSemences('moi', 2026)
    const plants = await getBesoinsPlants('moi', 2026)

    expect(semences.find((b) => b.especeId === 'Tomate')?.nbPlants).toBe(40)
    expect(plants.find((b) => b.especeId === 'Tomate')?.nbPlants).toBe(40)
  })

  it('deux cultures de la même année se partagent toujours la planche', async () => {
    m.db.culture.findMany.mockResolvedValue([
      culture({ id: 1, nbRangs: 1, espacement: 25, datePlantation: new Date('2026-05-11T00:00:00Z') }),
      culture({ id: 2, nbRangs: 1, espacement: 25, datePlantation: new Date('2026-08-10T00:00:00Z') }),
    ])
    const plants = await getBesoinsPlants('moi', 2026)
    expect(plants.map((b) => b.nbPlants)).toEqual([20, 20])
  })
})

describe('graines par gramme : repli par nom d’espèce', () => {
  it('une espèce personnelle nommée « Tomate » reçoit le repli de la tomate', async () => {
    const perso = { ...especesRef[0], id: 'cmespeceperso0001', nom: 'Tomate' }
    m.db.espece.findMany.mockResolvedValue([perso])
    m.db.culture.findMany.mockResolvedValue([
      culture({ especeId: perso.id, espece: { id: perso.id, couleur: null, rendement: 2 }, quantite: 40 }),
    ])

    const [besoin] = await getBesoinsSemences('moi', 2026)
    expect(defaultGrainesParGramme('Tomate')).toBeGreaterThan(0)
    expect(besoin.nbGrainesG).toBe(defaultGrainesParGramme('Tomate'))
    expect(besoin.nbGrainesGEstime).toBe(true)
    expect(besoin.grainesNecessaires).toBeGreaterThan(0)
  })
})

describe('filtres et bornes des requêtes', () => {
  it('filtrer par planche ET par îlot garde les deux critères', async () => {
    await getCulturesPrevues('moi', 2026, { plancheId: 'A1', ilot: 'A' })
    const where = m.db.culture.findMany.mock.calls[0][0].where
    expect(where.planche).toEqual({ nom: 'A1', ilot: 'A' })
  })

  it('Semences ne charge que les espèces et variétés des cultures de l’année', async () => {
    m.db.culture.findMany.mockResolvedValue([culture({ varieteId: 'v-coeur', quantite: 40 })])
    await getBesoinsSemences('moi', 2026)

    const especesWhere = m.db.espece.findMany.mock.calls.map((c) => c[0]?.where)
    expect(especesWhere.every((w) => w?.id?.in)).toBe(true)
    expect(especesWhere[0].id.in).toEqual(['Tomate'])
    expect(m.db.variete.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['v-coeur'] } })
  })

  it('Plants ne charge que les espèces des cultures lues', async () => {
    m.db.culture.findMany.mockResolvedValue([
      culture({ quantite: 40, datePlantation: new Date('2026-05-11T00:00:00Z') }),
    ])
    await getBesoinsPlants('moi', 2026)
    const especesWhere = m.db.espece.findMany.mock.calls.map((c) => c[0]?.where)
    expect(especesWhere.every((w) => w?.id?.in)).toBe(true)
  })
})

describe('relecture du 2026-11-12 — pérennes dans « Récoltes prévues »', () => {
  // Lecture simulée : applique le filtre d'année reçu, comme la base.
  type Ligne = ReturnType<typeof culture>
  const lireSelonAnnee = (lignes: Ligne[]) =>
    vi.fn(async ({ where }: { where: { annee?: number; OR?: { annee: number | { lt: number } }[] } }) => {
      const convient = (l: Ligne, a: number | { lt: number } | undefined) =>
        typeof a === 'number' ? l.annee === a : a ? (l.annee ?? 0) < a.lt : true
      return lignes.filter((l) => (where.OR ? where.OR.some((c) => convient(l, c.annee)) : convient(l, where.annee)))
    })

  it('une culture plantée trois ans plus tôt est comptée l’année de sa récolte, une seule fois', async () => {
    const avocatier = culture({
      id: 7,
      annee: 2026,
      datePlantation: new Date('2026-06-15T00:00:00Z'),
      dateRecolte: new Date('2029-06-25T00:00:00Z'),
    })
    m.db.culture.findMany = lireSelonAnnee([avocatier])

    const en2029 = await getRecoltesPrevuesDetail('moi', 2029, 'mois')
    expect(en2029.periodes[5].especes).toHaveLength(1)
    expect(en2029.periodes.filter((p) => p.especes.length > 0)).toHaveLength(1)

    const semaines = await getRecoltesPrevuesDetail('moi', 2029, 'semaine')
    expect(semaines.periodes.filter((p) => p.especes.length > 0).map((p) => p.periodeNum)).toEqual([26])

    // Ni l'année de plantation ni une année intermédiaire ne la comptent.
    for (const annee of [2026, 2028, 2030]) {
      const detail = await getRecoltesPrevuesDetail('moi', annee, 'mois')
      expect(detail.periodes.every((p) => p.especes.length === 0), `${annee}`).toBe(true)
    }
  })
})
