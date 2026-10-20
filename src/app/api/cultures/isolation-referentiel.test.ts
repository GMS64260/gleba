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
 * Revue 2026-10-20 — les cultures embarquent la ligne complète de l'espèce,
 * de la variété et de l'ITP : l'id de l'auteur d'une entrée partagée par un
 * autre compte sortait de la liste, de la fiche, du POST, du PUT et du
 * report d'étape. La fiche emportait aussi le fournisseur complet de la
 * variété (coordonnées, bloc bancaire) qu'aucun écran ne lit. La base simulée
 * rend ce que `include` / `select` demandent.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: mocks.requireAuthApi,
  getUserId: (session: { user: { id: string } }) => session.user.id,
}))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock('@/lib/rotation-check', () => ({ checkRotationViolation: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/varietes', () => ({ ensurePlaceholderVariete: vi.fn().mockResolvedValue('v-cm-partagee') }))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock('@/lib/terroir', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/terroir')>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))

import { GET as LISTE, POST } from './route'
import { GET, PUT } from './[id]/route'
import { POST as REPORTER } from './[id]/reporter/route'

const especes = jeuReferentiel((id, nom) => ({
  id, nom, type: 'legume', vivace: false, rendement: 2, uniteRendement: 'kg_m2', besoinEau: 2, irrigation: null, couleur: '#0a0', famille: null,
}))
const varietes = jeuReferentiel((id, nom) => ({
  id: `v-${id}`,
  nom: `Variété ${nom}`,
  especeId: id,
  fournisseurId: 'graines-sa',
  fournisseur: { id: 'graines-sa', contact: 'Jean', email: 'jean@graines.example', iban: 'FR76-IBAN-SECRET' },
}))
const itps = jeuReferentiel((id, nom) => ({
  id: `i-${id}`,
  nom: `Itinéraire ${nom}`,
  especeId: id,
  actif: true,
  modeDemarrage: null,
  typePlanche: null,
  zoneClimat: null,
  semaineSemis: 41,
  semainePlantation: 47,
  semaineRecolte: 3,
  semaineRecolteFin: 17,
  dureeRecolte: 14,
  espacementRangs: 35,
  nbGrainesPlant: null,
  doseSemis: null,
}))

const planche = (): Ligne => ({
  id: 'p1', userId: MOI, nom: 'B1', type: null, largeur: 0.9, longueur: 24, cultures: [], rotation: null,
})

/** Culture du compte conduite sur les entrées partagées par un autre membre. */
const culture = (): Ligne => ({
  id: 1174,
  userId: MOI,
  annee: 2026,
  especeId: 'cm-partagee',
  varieteId: 'v-cm-partagee',
  itpId: 'i-cm-partagee',
  plancheId: 'p1',
  dateSemis: new Date('2026-10-09T22:00:00.000Z'),
  datePlantation: new Date('2026-11-20T23:00:00.000Z'),
  dateRecolte: new Date('2027-01-15T23:00:00.000Z'),
  finRecolte: null,
  dateSemisPlan: null,
  datePlantationPlan: null,
  dateRecoltePlan: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  terminee: null,
  aIrriguer: false,
  quantite: 160,
  nbRangs: 2,
  longueur: 24,
  notes: null,
  espece: especes.partagee,
  variete: varietes.partagee,
  itp: itps.partagee,
  planche: planche(),
  recoltes: [],
  _count: { recoltes: 0 },
})

/** Corps envoyé par /maraichage/cultures/new. */
const corpsFormulaire = () => ({
  especeId: 'cm-partagee',
  varieteId: 'v-cm-partagee',
  itpId: 'i-cm-partagee',
  plancheId: 'p1',
  annee: 2026,
  dateSemis: '2026-10-09T22:00:00.000Z',
  datePlantation: '2026-11-20T23:00:00.000Z',
  dateRecolte: '2027-01-15T23:00:00.000Z',
  finRecolte: null,
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  terminee: null,
  quantite: 160,
  nbRangs: 2,
  longueur: 24,
  espacement: 30,
  notes: null,
  confirmRotation: false,
})

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

/** Les champs que les écrans lisent sortent toujours ; l'id tiers jamais. */
function attendreReferentielsMasques(corps: Ligne) {
  const espece = corps.espece as Ligne
  const variete = corps.variete as Ligne
  const itp = corps.itp as Ligne
  expect(espece).toMatchObject({ id: 'cm-partagee', nom: 'Entrée partagée', uniteRendement: 'kg_m2', couleur: '#0a0', userId: 'communaute' })
  expect(variete).toMatchObject({ id: 'v-cm-partagee', nom: 'Variété Entrée partagée', userId: 'communaute' })
  expect(itp).toMatchObject({ id: 'i-cm-partagee', nom: 'Itinéraire Entrée partagée', semainePlantation: 47, userId: 'communaute' })
  expect(corps.userId).toBe(MOI)
  expect(JSON.stringify(corps)).not.toContain(AUTRE)
}

let cultures: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  cultures = delegueMemoire([culture()])
  Object.assign(mocks.db, {
    culture: cultures,
    espece: delegueMemoire(Object.values(especes)),
    variete: delegueMemoire(Object.values(varietes)),
    iTP: delegueMemoire(Object.values(itps)),
    planche: delegueMemoire([planche()]),
    userStockEspece: { findMany: vi.fn(async () => []) },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        culture: {
          // Comme Prisma : la ligne créée revient avec ses relations incluses.
          create: vi.fn(async ({ data }: { data: Ligne }) => ({ ...culture(), ...data, id: 1193 })),
        },
      }),
  })
})

describe('GET /api/cultures — liste', () => {
  it("espèce, variété et ITP d'un autre compte sortent masqués, avec les champs des écrans", async () => {
    const res = await LISTE(requete('GET', '/api/cultures?page=1&pageSize=50&annee=2026'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.total).toBe(1)
    attendreReferentielsMasques(corps.data[0])
    // Champs calculés de la liste inchangés.
    expect(corps.data[0]).toMatchObject({ etat: 'Planifiée', totalRecolte: 0 })
    expect(corps.data[0].espece.rendement).toBe(2)
  })
})

describe('GET /api/cultures/[id] — fiche', () => {
  it("fiche masquée ; le fournisseur de la variété se limite à son id", async () => {
    const res = await GET(requete('GET', '/api/cultures/1174'), params('1174'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    attendreReferentielsMasques(corps)
    expect(corps.variete.fournisseur).toEqual({ id: 'graines-sa' })
    expect(JSON.stringify(corps)).not.toContain('IBAN-SECRET')
    expect(JSON.stringify(corps)).not.toContain('jean@graines.example')
  })
})

describe('POST /api/cultures — corps de /maraichage/cultures/new', () => {
  it('la culture créée revient masquée (201)', async () => {
    const res = await POST(requete('POST', '/api/cultures', corpsFormulaire()))
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.id).toBe(1193)
    attendreReferentielsMasques(corps)
  })
})

describe('PUT /api/cultures/[id] — corps de la fiche culture', () => {
  it('la culture modifiée revient masquée', async () => {
    const res = await PUT(
      requete('PUT', '/api/cultures/1174', { especeId: 'cm-partagee', varieteId: 'v-cm-partagee', notes: 'arrosée' }),
      params('1174'),
    )
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.notes).toBe('arrosée')
    attendreReferentielsMasques(corps)
  })
})

describe('POST /api/cultures/[id]/reporter — report d’étape', () => {
  it('la culture reportée revient masquée', async () => {
    const res = await REPORTER(requete('POST', '/api/cultures/1174/reporter', { etape: 'semis', date: '2026-10-15' }), params('1174'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.decalages[0].etape).toBe('semis')
    expect(corps.culture.espece).toMatchObject({ nom: 'Entrée partagée', userId: 'communaute' })
    expect(corps.culture.variete.userId).toBe('communaute')
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})
