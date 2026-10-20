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
 * Revue 2026-10-20 — la fiche et la modification d'une rotation embarquent
 * l'ITP de chaque étape et son espèce : l'id de l'auteur d'une entrée
 * partagée par un autre compte sortait.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  requireAdminApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: mocks.requireAuthApi,
  requireAdminApi: mocks.requireAdminApi,
}))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/rotations/itp-etapes', () => ({
  etapesRotationInvalides: vi.fn(async () => []),
  messageEtapesInvalides: vi.fn(() => ''),
}))

import { GET, PUT } from './route'

const especes = jeuReferentiel((id, nom) => ({ id, nom, type: 'legume', familleId: null, famille: null }))
const itps = jeuReferentiel((id, nom) => ({
  id: `i-${id}`, nom: `Itinéraire ${nom}`, especeId: id, espece: especes[id === 'gleba-1' ? 'gleba' : 'partagee'],
}))

const rotation = (): Ligne => ({
  id: 'Rotation courte',
  active: true,
  nbAnnees: 2,
  notes: null,
  details: [
    { id: 1, rotationId: 'Rotation courte', annee: 1, itpId: 'i-cm-partagee', itp: itps.partagee },
    { id: 2, rotationId: 'Rotation courte', annee: 2, itpId: 'i-gleba-1', itp: itps.gleba },
  ],
  planches: [
    { id: 'p1', userId: MOI, ilot: null, longueur: 24, largeur: 0.9 },
    { id: 'p2', userId: AUTRE, ilot: null, longueur: 10, largeur: 1 },
  ],
  _count: { planches: 1 },
})

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

let rotations: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  mocks.requireAdminApi.mockResolvedValue(sessionDe('admin-1', 'ADMIN'))
  rotations = delegueMemoire([rotation()])
  mocks.db.rotation = rotations
  mocks.db.rotationDetail = { deleteMany: vi.fn(), create: vi.fn(), findMany: vi.fn(async () => []) }
  mocks.db.planche = { count: vi.fn(async () => 0) }
  // Comme Prisma : la ligne écrite revient avec les seules relations incluses
  // par le PUT (`details.itp.espece`), sans les planches.
  const update = vi.fn(async ({ data }: { data: Ligne }) => {
    const ligne = rotation()
    delete ligne.planches
    delete ligne._count
    return { ...ligne, ...data }
  })
  mocks.db.$transaction = async (fn: (tx: unknown) => unknown) =>
    fn({ rotation: { ...rotations, update }, rotationDetail: mocks.db.rotationDetail })
})

describe('GET /api/rotations/[id] — fiche', () => {
  it("ITP et espèce de chaque étape masqués, planches du seul compte", async () => {
    const res = await GET(requete('GET', '/api/rotations/Rotation%20courte'), params('Rotation courte'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.details.map((d: { itp: Ligne & { espece: Ligne } }) => [d.itp.nom, d.itp.userId, d.itp.espece.userId])).toEqual([
      ['Itinéraire Entrée partagée', 'communaute', 'communaute'],
      ['Itinéraire Entrée Gleba', null, null],
    ])
    expect(corps.planches.map((p: Ligne) => p.id)).toEqual(['p1'])
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})

describe('PUT /api/rotations/[id] — corps de la fiche rotation (admin)', () => {
  it("la rotation modifiée revient sans l'id de l'auteur des ITP", async () => {
    const res = await PUT(requete('PUT', '/api/rotations/Rotation%20courte', { notes: 'cycle court' }), params('Rotation courte'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.notes).toBe('cycle court')
    expect(corps.details[0].itp).toMatchObject({ nom: 'Itinéraire Entrée partagée', userId: 'communaute' })
    expect(corps.details[0].itp.espece.userId).toBe('communaute')
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})
