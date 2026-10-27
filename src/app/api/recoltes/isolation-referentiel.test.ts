import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTRE,
  MOI,
  delegueMemoire,
  jeuReferentiel,
  sessionDe,
  type Ligne,
} from '@/lib/__tests__/fixtures/referentiel-memoire'

/**
 * Revue 2026-10-20 — les récoltes embarquent la ligne complète de l'espèce et
 * (via la culture) de la variété et de l'ITP : l'id de l'auteur d'une entrée
 * partagée par un autre compte sortait dans la liste, la fiche et les
 * réponses d'écriture. La base simulée rend ce que `include` demande.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createVenteFromRecolte: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/facture-utils', () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))

import { GET as LISTE, POST } from './route'
import { GET, PATCH, PUT } from './[id]/route'

beforeAll(() => { vi.stubEnv('TZ', 'Europe/Paris') })
afterAll(() => { vi.unstubAllEnvs() })

const especes = jeuReferentiel((id, nom) => ({
  id, nom, type: 'legume', vivace: false, rendement: 2, uniteRendement: 'kg_m2', famille: null,
}))
const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom: `Variété ${nom}`, especeId: id }))
const itps = jeuReferentiel((id, nom) => ({ id: `i-${id}`, nom: `Itinéraire ${nom}`, especeId: id }))

/** Culture du compte conduite sur l'espèce partagée par un autre membre. */
const culture = (): Ligne => ({
  id: 1174,
  userId: MOI,
  especeId: 'cm-partagee',
  varieteId: 'v-cm-partagee',
  itpId: 'i-cm-partagee',
  plancheId: null,
  dateSemis: new Date('2026-10-09T22:00:00.000Z'),
  datePlantation: new Date('2026-11-20T23:00:00.000Z'),
  dateRecolte: new Date('2027-01-15T23:00:00.000Z'),
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  espece: especes.partagee,
  variete: varietes.partagee,
  itp: itps.partagee,
  planche: null,
})

const recolte = (): Ligne => ({
  id: 1150,
  userId: MOI,
  cultureId: 1174,
  especeId: 'cm-partagee',
  date: new Date('2027-01-20T12:00:00.000Z'),
  quantite: 25,
  unite: 'kg',
  statut: 'en_stock',
  prixKg: null,
  prixTotal: null,
  dateVente: null,
  clientId: null,
  clientNom: null,
  datePeremption: null,
  notes: null,
  factureId: null,
  statutBioSnapshot: null,
  espece: especes.partagee,
  culture: culture(),
})

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

/** Les champs que les écrans lisent sur l'espèce embarquée sortent, l'id tiers jamais. */
function attendreEspeceMasquee(espece: Ligne) {
  expect(espece.userId).toBe('communaute')
  expect(espece.nom).toBe('Entrée partagée')
  expect(espece.uniteRendement).toBe('kg_m2')
}

let recoltes: ReturnType<typeof delegueMemoire>
let cultures: ReturnType<typeof delegueMemoire>
const tx = { recolte: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() }, culture: { update: vi.fn() }, produitBoutique: { count: vi.fn(async () => 0) }, $queryRaw: vi.fn(async () => []), $executeRaw: vi.fn(async () => 1) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  recoltes = delegueMemoire([recolte()])
  cultures = delegueMemoire([culture()])
  mocks.db.recolte = { ...recoltes, groupBy: vi.fn(async () => []) }
  mocks.db.culture = cultures
  mocks.db.userStockEspece = { findMany: vi.fn(async () => []) }
  mocks.db.produitBoutique = { findFirst: vi.fn(async () => null), count: vi.fn(async () => 0) }
  tx.recolte.findFirst.mockImplementation(recoltes.findFirst)
  mocks.db.$transaction = async (fn: (t: typeof tx) => unknown) => fn(tx)
  // Comme Prisma : la ligne écrite revient avec ses relations incluses.
  tx.recolte.create.mockImplementation(async ({ data }: { data: Ligne }) => ({ ...recolte(), ...data, id: 1151 }))
  tx.recolte.update.mockImplementation(async ({ data }: { data: Ligne }) => ({ ...recolte(), ...data }))
})

describe('GET /api/recoltes — liste', () => {
  it("l'espèce et la variété d'un autre compte sortent masquées, avec leurs libellés", async () => {
    const res = await LISTE(requete('GET', '/api/recoltes?page=1&pageSize=50'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.data).toHaveLength(1)
    attendreEspeceMasquee(corps.data[0].espece)
    expect(corps.data[0].culture.variete).toMatchObject({ id: 'v-cm-partagee', nom: 'Variété Entrée partagée', userId: 'communaute' })
    expect(corps.data[0].userId).toBe(MOI)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})

describe('GET /api/recoltes/[id] — fiche', () => {
  it("espèce, variété et ITP embarqués sans l'id d'un autre compte", async () => {
    const res = await GET(requete('GET', '/api/recoltes/1150'), params('1150'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    attendreEspeceMasquee(corps.espece)
    expect(corps.culture.variete.userId).toBe('communaute')
    expect(corps.culture.itp).toMatchObject({ nom: 'Itinéraire Entrée partagée', userId: 'communaute' })
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})

describe('POST /api/recoltes — corps de /maraichage/recoltes/saisie', () => {
  it("la récolte créée revient avec son espèce masquée", async () => {
    const res = await POST(requete('POST', '/api/recoltes', {
      especeId: 'cm-partagee',
      cultureId: 1174,
      quantite: 25,
      date: new Date('2027-01-20T00:00:00.000Z'),
      datePeremption: null,
      notes: null,
    }))
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.id).toBe(1151)
    attendreEspeceMasquee(corps.espece)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})

describe('PUT / PATCH /api/recoltes/[id] — corps de la fiche récolte', () => {
  it('PUT (date, quantité, notes) : réponse sans id tiers', async () => {
    const res = await PUT(
      requete('PUT', '/api/recoltes/1150', { date: '2027-01-20T12:00:00.000Z', quantite: 30, notes: null }),
      params('1150'),
    )
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.quantite).toBe(30)
    attendreEspeceMasquee(corps.espece)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })

  it('PATCH (notes) : espèce et variété de la culture masquées', async () => {
    const res = await PATCH(requete('PATCH', '/api/recoltes/1150', { notes: 'lavée' }), params('1150'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.notes).toBe('lavée')
    attendreEspeceMasquee(corps.espece)
    expect(corps.culture.variete.userId).toBe('communaute')
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})
