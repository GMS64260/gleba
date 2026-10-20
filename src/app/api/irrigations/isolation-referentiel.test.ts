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
 * Revue 2026-10-20 — la création, la fiche et la modification d'une
 * irrigation renvoient la culture avec la ligne complète de son espèce : l'id
 * de l'auteur d'une espèce partagée par un autre compte sortait.
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
vi.mock('@/lib/irrigation-recording', () => ({ enregistrerArrosageCultures: vi.fn() }))

import { POST } from './route'
import { GET, PATCH } from './[id]/route'

const especes = jeuReferentiel((id, nom) => ({ id, nom, couleur: '#0a0', besoinEau: 3 }))

const culture = (): Ligne => ({ id: 1174, userId: MOI, especeId: 'cm-partagee', plancheId: null, espece: especes.partagee })
const irrigation = (): Ligne => ({
  id: 5,
  userId: MOI,
  cultureId: 1174,
  datePrevue: new Date('2026-10-21T00:00:00.000Z'),
  dateEffective: null,
  fait: false,
  perimee: false,
  notes: null,
  culture: culture(),
})

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

const attendreEspeceMasquee = (espece: Ligne) => {
  expect(espece.userId).toBe('communaute')
  expect(espece).toMatchObject({ id: 'cm-partagee', nom: 'Entrée partagée', couleur: '#0a0', besoinEau: 3 })
}

let irrigations: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  irrigations = delegueMemoire([irrigation()])
  mocks.db.irrigationPlanifiee = {
    ...irrigations,
    findUniqueOrThrow: irrigations.findUnique,
    updateMany: vi.fn(async () => ({ count: 1 })),
    create: vi.fn(async ({ data }: { data: Ligne }) => ({ ...irrigation(), ...data, id: 6 })),
  }
  mocks.db.culture = delegueMemoire([culture()])
})

describe('POST /api/irrigations — corps du calendrier d’arrosage', () => {
  it("l'irrigation créée revient avec l'espèce de sa culture masquée", async () => {
    const res = await POST(requete('POST', '/api/irrigations', { cultureId: 1174, datePrevue: '2026-10-21', notes: null }))
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.id).toBe(6)
    attendreEspeceMasquee(corps.culture.espece)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})

describe('GET / PATCH /api/irrigations/[id]', () => {
  it('GET : fiche sans id tiers', async () => {
    const res = await GET(requete('GET', '/api/irrigations/5'), params('5'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    attendreEspeceMasquee(corps.culture.espece)
    expect(corps.userId).toBe(MOI)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })

  it('PATCH (notes) : la ligne relue après écriture est masquée', async () => {
    const res = await PATCH(requete('PATCH', '/api/irrigations/5', { notes: 'le soir' }), params('5'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.irrigationIds).toEqual([5])
    attendreEspeceMasquee(corps.culture.espece)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})
