import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTRE,
  MOI,
  delegueMemoire,
  jeuReferentiel,
  sessionDe,
  type Ligne,
} from '@/lib/__tests__/fixtures/referentiel-memoire'

/**
 * Revue 2026-10-20 — le registre des interventions lisait la ligne complète
 * de l'espèce et de la variété des cultures (trois lectures) pour n'en
 * composer qu'un libellé. Il ne demande plus que `id` et `nom`, et aucun id
 * d'un autre compte ne sort.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/cache-helper', () => ({ getOrFetch: vi.fn() }))
vi.mock('@/lib/meteo', () => ({ fetchOpenMeteoHistory: vi.fn() }))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock('@/lib/irrigation-recording', () => ({ supprimerArrosageNote: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromIntervention: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/planches/resolution', () => ({ resoudreIdPlanche: vi.fn(async (_p: unknown, ref: string) => ref) }))

import { GET } from './route'

const especes = jeuReferentiel((id, nom) => ({ id, nom, type: 'legume' }))
const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom: `Variété ${nom}`, especeId: id }))

const culture = (): Ligne => ({
  id: 1174,
  userId: MOI,
  annee: 2026,
  especeId: 'cm-partagee',
  varieteId: 'v-cm-partagee',
  plancheId: 'p1',
  dateSemis: new Date('2026-10-09T22:00:00.000Z'),
  datePlantation: null,
  dateRecolte: new Date('2027-01-15T23:00:00.000Z'),
  semisFait: true,
  plantationFaite: false,
  recolteFaite: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  espece: especes.partagee,
  variete: varietes.partagee,
  planche: { id: 'p1', userId: MOI, nom: 'B1' },
})

const intervention = (): Ligne => ({
  id: 1,
  userId: MOI,
  date: new Date('2026-10-12T10:00:00.000Z'),
  type: 'desherbage',
  cultureId: 1174,
  plancheId: null,
  arbreId: null,
  fait: true,
  dureeMinutes: 30,
  nbPersonnes: 1,
  coutMainOeuvre: null,
  coutTotal: null,
  description: null,
  datePrevue: null,
  notes: null,
  createdAt: new Date('2026-10-12T10:00:00.000Z'),
  updatedAt: new Date('2026-10-12T10:00:00.000Z'),
})

const arrosage = (): Ligne => ({
  id: 5,
  userId: MOI,
  cultureId: 1174,
  datePrevue: new Date('2026-10-14T00:00:00.000Z'),
  dateEffective: new Date('2026-10-14T18:00:00.000Z'),
  fait: true,
  perimee: false,
  notes: null,
  createdAt: new Date('2026-10-14T00:00:00.000Z'),
  updatedAt: new Date('2026-10-14T00:00:00.000Z'),
  culture: culture(),
})

let cultures: ReturnType<typeof delegueMemoire>
let irrigations: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  cultures = delegueMemoire([culture()])
  irrigations = delegueMemoire([arrosage()])
  const vide = { findMany: vi.fn(async () => []) }
  Object.assign(mocks.db, {
    intervention: { findMany: vi.fn(async () => [intervention()]) },
    culture: cultures,
    irrigationPlanifiee: irrigations,
    planche: vide,
    arbre: vide,
    fertilisation: vide,
    operationArbre: vide,
    soinAnimal: vide,
  })
})

describe('GET /api/interventions — registre fusionné', () => {
  it("libellés de culture composés, aucun id d'un autre compte, espèce et variété lues en `select`", async () => {
    const res = await GET(new NextRequest('http://localhost/api/interventions?annee=2026'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    const parSource = Object.fromEntries(corps.data.map((e: Ligne) => [e.source, e])) as Record<string, Ligne>
    expect(parSource.intervention.cultureNom).toBe('Entrée partagée - Variété Entrée partagée')
    expect(parSource.intervention.plancheNom).toBe('B1')
    expect(parSource.culture.cultureNom).toBe('Entrée partagée - Variété Entrée partagée')
    expect(parSource.irrigation.cultureNom).toBe('cm-partagee')
    expect(JSON.stringify(corps)).not.toContain(AUTRE)

    const libelle = { select: { id: true, nom: true } }
    for (const appel of cultures.findMany.mock.calls) {
      expect(appel[0]?.include).toMatchObject({ espece: libelle, variete: libelle })
    }
    expect(irrigations.findMany.mock.calls[0][0]?.include).toMatchObject({
      culture: { include: { espece: { select: { id: true } } } },
    })
  })
})
