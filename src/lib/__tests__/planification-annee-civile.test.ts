/**
 * Revue du 2026-11-11 — bascules d'année et jours civils de la planification.
 *
 * Deux calendriers se croisent dans « Récoltes prévues » : le tableau par
 * SEMAINES suit l'année ISO, le tableau par MOIS l'année civile. Les mélanger
 * rangeait une récolte du 2 janvier 2027 (semaine ISO 53 de 2026) en janvier
 * 2026, et une récolte du 29 décembre 2025 (semaine ISO 1 de 2026) en décembre
 * 2026.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  db: {} as Record<string, { findMany: ReturnType<typeof vi.fn> }>,
}))
vi.mock('@/lib/prisma', () => ({ default: m.db }))
vi.mock('@/lib/terroir', async (original) => ({
  ...(await original<typeof import('@/lib/terroir')>()),
  zoneEffectiveUser: vi.fn(async () => null),
}))

import { getCulturesPrevues, getRecoltesPrevuesDetail } from '@/lib/planification'

const espece = { id: 'Radis', nom: 'Radis', couleur: null, rendement: 2, uniteRendement: 'kg_m2' }
const planche = { id: 'p1', nom: 'P1', largeur: 1, longueur: 10, surface: 10, ilot: null, rotationId: null, annee: null }

function culture(extra: Record<string, unknown>) {
  return {
    id: 1,
    userId: 'moi',
    annee: 2026,
    especeId: 'Radis',
    espece,
    varieteId: null,
    itpId: null,
    itp: null,
    plancheId: 'p1',
    planche,
    longueur: 10,
    quantite: 100,
    nbRangs: 1,
    espacement: 10,
    dateSemis: null,
    datePlantation: null,
    dateRecolte: null,
    recolteFaite: false,
    terminee: null,
    ...extra,
  }
}

const tzAvant = process.env.TZ
beforeAll(() => {
  // Le conteneur de production tourne en Europe/Paris.
  process.env.TZ = 'Europe/Paris'
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(m.db, {
    planche: { findMany: vi.fn(async () => []) },
    culture: { findMany: vi.fn(async () => []) },
    espece: { findMany: vi.fn(async () => [espece]) },
    userStockEspece: { findMany: vi.fn(async () => []) },
  })
})

const kgParPeriode = (periodes: { totalKg: number }[]) => periodes.map((p) => p.totalKg)

describe('récoltes prévues par mois : année civile de la date stockée', () => {
  it('une récolte du 2 janvier 2027 (semaine ISO 53 de 2026) va en janvier 2027, pas en janvier 2026', async () => {
    m.db.culture.findMany.mockResolvedValue([culture({ annee: 2026, dateRecolte: new Date('2027-01-02T00:00:00Z') })])

    const mois2026 = await getRecoltesPrevuesDetail('moi', 2026, 'mois')
    expect(kgParPeriode(mois2026.periodes).every((kg) => kg === 0)).toBe(true)
    expect(mois2026.projectionCreeesKg).toBe(0)

    const mois2027 = await getRecoltesPrevuesDetail('moi', 2027, 'mois')
    expect(mois2027.periodes[0].totalKg).toBe(20)
    expect(mois2027.projectionCreeesKg).toBe(20)

    // Le tableau par semaines garde le calendrier ISO : S53 de 2026.
    const semaines2026 = await getRecoltesPrevuesDetail('moi', 2026, 'semaine')
    expect(semaines2026.periodes[52].totalKg).toBe(20)
    const semaines2027 = await getRecoltesPrevuesDetail('moi', 2027, 'semaine')
    expect(kgParPeriode(semaines2027.periodes).every((kg) => kg === 0)).toBe(true)
  })

  it('une récolte du 29 décembre 2025 (semaine ISO 1 de 2026) reste en décembre 2025', async () => {
    m.db.culture.findMany.mockResolvedValue([culture({ annee: 2025, dateRecolte: new Date('2025-12-29T00:00:00Z') })])

    const mois2026 = await getRecoltesPrevuesDetail('moi', 2026, 'mois')
    expect(kgParPeriode(mois2026.periodes).every((kg) => kg === 0)).toBe(true)

    const mois2025 = await getRecoltesPrevuesDetail('moi', 2025, 'mois')
    expect(mois2025.periodes[11].totalKg).toBe(20)

    // Par semaines : S01 de 2026, comme avant.
    const semaines2026 = await getRecoltesPrevuesDetail('moi', 2026, 'semaine')
    expect(semaines2026.periodes[0].totalKg).toBe(20)
  })

  it('le total de l’en-tête reste la somme du tableau affiché', async () => {
    m.db.culture.findMany.mockResolvedValue([
      culture({ id: 1, annee: 2026, dateRecolte: new Date('2026-07-01T00:00:00Z') }),
      culture({ id: 2, annee: 2026, dateRecolte: new Date('2027-01-02T00:00:00Z') }),
    ])
    for (const groupBy of ['mois', 'semaine'] as const) {
      const r = await getRecoltesPrevuesDetail('moi', 2026, groupBy)
      expect(r.periodes.reduce((s, p) => s + p.totalKg, 0)).toBe(r.projectionCreeesKg)
    }
  })
})

describe('récoltes prévues par mois : suggestion de rotation sans date', () => {
  const itp = {
    id: 'itp-mache',
    especeId: 'Radis',
    espece: { couleur: null },
    userId: null,
    zoneClimat: null,
    semaineSemis: null,
    semainePlantation: null,
    semaineRecolte: 1,
    dureeCulture: 60,
    nbRangs: 1,
    espacement: 10,
  }
  const plancheRotation = {
    ...planche,
    rotationId: 'rot',
    annee: 2026,
    rotation: { nbAnnees: 1, details: [{ annee: 1, itpId: 'itp-mache', itp }] },
    cultures: [],
  }

  it('la semaine 1 de 2026 (lundi 29/12/2025) se range en janvier, pas en décembre 2026', async () => {
    m.db.planche.findMany.mockResolvedValue([plancheRotation])

    const mois = await getRecoltesPrevuesDetail('moi', 2026, 'mois')
    expect(mois.periodes[0].totalKg).toBe(20)
    expect(mois.periodes[11].totalKg).toBe(0)
    const semaines = await getRecoltesPrevuesDetail('moi', 2026, 'semaine')
    expect(semaines.periodes[0].totalKg).toBe(20)
  })
})

describe('semaine d’une date stockée : jour civil, pas instant + 12 h', () => {
  it('un semis coché « fait » un dimanche à 15 h reste dans sa semaine', async () => {
    // Dimanche 21 mars 2027, 15:00 à Paris : l'étape marquée faite porte l'instant du clic.
    m.db.culture.findMany.mockResolvedValue([
      culture({ annee: 2027, dateSemis: new Date('2027-03-21T14:00:00.000Z'), dateRecolte: new Date('2027-05-17T00:00:00Z') }),
    ])
    const [prevue] = await getCulturesPrevues('moi', 2027)
    expect(prevue.semaineSemis).toBe(11)
    expect(prevue.semaineRecolte).toBe(20)
  })

  it('lit le même jour pour un minuit UTC et pour un minuit de Paris', async () => {
    m.db.culture.findMany.mockResolvedValue([
      culture({ id: 1, annee: 2027, dateSemis: new Date('2027-03-22T00:00:00.000Z') }),
      culture({ id: 2, annee: 2027, dateSemis: new Date('2027-03-21T23:00:00.000Z') }),
    ])
    const prevues = await getCulturesPrevues('moi', 2027)
    expect(prevues.map((p) => p.semaineSemis)).toEqual([12, 12])
  })

  it('un dimanche 3 janvier 2027 après-midi reste en semaine 53 de 2026', async () => {
    m.db.culture.findMany.mockResolvedValue([
      culture({ annee: 2026, datePlantation: new Date('2027-01-03T15:30:00.000Z') }),
    ])
    const [en2026] = await getCulturesPrevues('moi', 2026)
    expect(en2026.semainePlantation).toBe(53)
  })
})
