import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  productionFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/effectif', () => ({
  reconstituerEffectifsLots: vi.fn().mockResolvedValue(new Map([[1, { effectifCalcule: 100 }]])),
}))
vi.mock('@/lib/elevage/pondeuses', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/elevage/pondeuses')>()),
  calculerTetesNonPondeuses: vi.fn().mockResolvedValue(new Map()),
  effectifsPondeursLots: vi.fn().mockResolvedValue(new Map()),
}))
vi.mock('@/lib/elevage/fenetre-mise-bas', () => ({
  chargerFenetresMiseBas: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    soinAnimal: { findMany: vi.fn().mockResolvedValue([]) },
    productionOeuf: { findMany: mocks.productionFindMany },
    consommationAliment: { findMany: vi.fn().mockResolvedValue([]) },
    lotAnimaux: { findMany: vi.fn().mockResolvedValue([{
      id: 1, quantiteInitiale: 100, quantiteActuelle: 100, statut: 'actif',
      especeAnimale: { ponteAnnuelle: 200, production: 'oeufs', type: 'volaille', nom: 'Marans', dureeElevage: 150 },
    }]) },
    animal: { count: vi.fn().mockResolvedValue(0) },
    saillie: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}))

import { GET } from '@/app/api/elevage/taches/route'

const JOUR = 86_400_000
const FERME = 'ferme-a'
const AUTRE_FERME = 'ferme-b'
const REFERENCE = new Date('2026-03-08T23:59:59.999Z')
const MAINTENANT = new Date('2026-11-18T12:00:00.000Z')
const decalage = (date: Date, jours: number) => new Date(date.getTime() + jours * JOUR)
const collecte = (date: Date, quantite: number, userId = FERME) => ({
  id: date.getTime(), date, quantite, userId, casses: 0, lot: null,
})
type Collecte = ReturnType<typeof collecte>
let collectes: Collecte[]

function observations(reference: Date, quantite: number, userId = FERME, jours = 14) {
  return Array.from({ length: jours }, (_, i) => collecte(decalage(reference, -i), quantite, userId))
}

async function estimation(reference = REFERENCE, maintenant = MAINTENANT, userId = FERME) {
  vi.setSystemTime(maintenant)
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: userId } } })
  const params = new URLSearchParams({ start: decalage(reference, -7).toISOString(), end: reference.toISOString() })
  const response = await GET(new NextRequest(`http://localhost/api/elevage/taches?${params}`))
  expect(response.status).toBe(200)
  const { stats } = await response.json()
  return { estimationOeufsJour: stats.estimationOeufsJour, estimationSource: stats.estimationSource }
}

beforeEach(() => {
  vi.useFakeTimers()
  collectes = []
  // Le faux stockage applique la requête réellement émise par la route : une
  // mauvaise borne temporelle ou l'absence de tenant doit changer le résultat.
  mocks.productionFindMany.mockImplementation(({ where }: {
    where: { userId?: string; date: { gte: Date; lte: Date } }
  }) => Promise.resolve(collectes.filter(p =>
    (!where.userId || p.userId === where.userId) && p.date >= where.date.gte && p.date <= where.date.lte,
  )))
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('estimation de ponte — référence de la semaine consultée', () => {
  it('conserve les 14 observations faibles de la semaine passée quand le présent avance', async () => {
    collectes = [
      ...observations(REFERENCE, 5),
      ...observations(MAINTENANT, 95),
    ]
    // Mars : modèle = 65/jour ; (65 + 5) / 2 = 35.
    const attendu = { estimationOeufsJour: 35, estimationSource: 'mixte' }
    expect(await estimation()).toEqual(attendu)
    expect(await estimation(REFERENCE, decalage(MAINTENANT, 180))).toEqual(attendu)
    expect(mocks.productionFindMany).toHaveBeenLastCalledWith({
      where: { userId: FERME, date: { gte: decalage(REFERENCE, -60), lte: REFERENCE } },
      select: { date: true, quantite: true },
    })
  })

  it('borne la semaine courante à maintenant, y compris une collecte à la milliseconde suivante', async () => {
    collectes = [
      ...observations(MAINTENANT, 5),
      collecte(new Date(MAINTENANT.getTime() + 1), 10000),
    ]
    // Novembre : modèle = 25/jour ; (25 + 5) / 2 = 15.
    expect(await estimation(decalage(MAINTENANT, 3))).toEqual({
      estimationOeufsJour: 15, estimationSource: 'mixte',
    })
    expect(mocks.productionFindMany).toHaveBeenLastCalledWith({
      where: { userId: FERME, date: { gte: decalage(MAINTENANT, -60), lte: MAINTENANT } },
      select: { date: true, quantite: true },
    })
  })

  it('garde le modèle théorique sans historique ou avec seulement 13 jours observés', async () => {
    const attendu = { estimationOeufsJour: 65, estimationSource: 'theorique' }
    expect(await estimation()).toEqual(attendu)
    collectes = observations(REFERENCE, 5, FERME, 13)
    expect(await estimation()).toEqual(attendu)
  })

  it('inclut les deux bornes des 60 jours et exclut la milliseconde précédente', async () => {
    collectes = [
      ...observations(REFERENCE, 5, FERME, 13),
      collecte(decalage(REFERENCE, -60), 5),
      collecte(new Date(decalage(REFERENCE, -60).getTime() - 1), 10000),
    ]
    expect(await estimation()).toEqual({ estimationOeufsJour: 35, estimationSource: 'mixte' })
  })

  it('garde indépendantes deux exploitations aux observations différentes', async () => {
    collectes = [...observations(REFERENCE, 5), ...observations(REFERENCE, 95, AUTRE_FERME)]
    expect(await estimation()).toEqual({ estimationOeufsJour: 35, estimationSource: 'mixte' })
    expect(await estimation(REFERENCE, MAINTENANT, AUTRE_FERME)).toEqual({
      estimationOeufsJour: 80, estimationSource: 'mixte',
    })
  })
})

const GRAINE = 0x20261118
const SERIES = 320

describe(`invariants estimation de ponte — graine 0x${GRAINE.toString(16)}, ${SERIES} séries`, () => {
  it('ignore toute collecte après la référence ou appartenant à un autre tenant', async () => {
    let etat = GRAINE
    const entier = (max: number) => {
      etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
      return etat % max
    }
    for (let serie = 0; serie < SERIES; serie++) {
      const reference = decalage(new Date('2024-01-01T12:00:00.000Z'), entier(700))
      const maintenant = decalage(reference, 120)
      collectes = Array.from({ length: entier(65) }, () =>
        collecte(decalage(reference, -entier(60)), entier(101)),
      )
      const attendu = await estimation(reference, maintenant)
      const initiales = [...collectes]
      // Certaines collectes sont à +1 ms, d'autres plusieurs mois après.
      collectes.push(collecte(new Date(reference.getTime() + 1), 10000 + entier(10000)))
      collectes.push(...observations(maintenant, 1000 + entier(1000)))
      expect(await estimation(reference, maintenant), `collectes postérieures, série ${serie}`).toEqual(attendu)
      collectes = [...initiales, ...observations(reference, 1000 + entier(1000), AUTRE_FERME, 60)]
      expect(await estimation(reference, maintenant), `autre tenant, série ${serie}`).toEqual(attendu)
      expect(await estimation(reference, decalage(maintenant, 180)), `horloge, série ${serie}`).toEqual(attendu)
    }
  })
})
