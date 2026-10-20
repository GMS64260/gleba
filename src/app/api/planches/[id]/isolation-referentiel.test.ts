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
 * Revue 2026-10-20 — la fiche d'une planche embarque les ITP des étapes de sa
 * rotation et l'espèce et la variété de ses cultures : l'id de l'auteur d'une
 * entrée partagée par un autre compte sortait.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock('@/lib/planches/resolution', () => ({
  resoudreIdPlanche: vi.fn(async (_db: unknown, reference: string) => reference),
}))

import { GET } from './route'

const especes = jeuReferentiel((id, nom) => ({ id, nom, type: 'legume', couleur: '#0a0' }))
const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom: `Variété ${nom}`, especeId: id }))
const itps = jeuReferentiel((id, nom) => ({ id: `i-${id}`, nom: `Itinéraire ${nom}`, especeId: id, semainePlantation: 20 }))

const planche = (): Ligne => ({
  id: 'p1',
  userId: MOI,
  nom: 'B1',
  rotationId: 'Rotation courte',
  rotation: {
    id: 'Rotation courte',
    active: true,
    details: [
      { id: 1, annee: 1, itpId: 'i-cm-partagee', itp: itps.partagee },
      { id: 2, annee: 2, itpId: 'i-gleba-1', itp: itps.gleba },
    ],
  },
  cultures: [
    { id: 1174, userId: MOI, annee: 2026, especeId: 'cm-partagee', espece: especes.partagee, variete: varietes.partagee },
    { id: 1175, userId: MOI, annee: 2025, especeId: 'cm-moi', espece: especes.moi, variete: varietes.moi },
  ],
  fertilisations: [],
  analyses: [],
  parcelleGeo: null,
})

const requete = (url: string) => new NextRequest(`http://localhost${url}`)
const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  mocks.db.planche = delegueMemoire([planche()])
})

describe('GET /api/planches/[id] — fiche', () => {
  it("ITP des étapes, espèce et variété des cultures : libellés présents, jamais l'id d'un autre compte", async () => {
    const res = await GET(requete('/api/planches/p1'), params('p1'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.rotation.details.map((d: { itp: Ligne }) => [d.itp.nom, d.itp.userId, d.itp.semainePlantation])).toEqual([
      ['Itinéraire Entrée partagée', 'communaute', 20],
      ['Itinéraire Entrée Gleba', null, 20],
    ])
    expect(corps.cultures.map((c: { espece: Ligne; variete: Ligne }) => [c.espece.userId, c.variete.userId])).toEqual([
      ['communaute', 'communaute'],
      [MOI, MOI],
    ])
    expect(corps.cultures[0].espece).toMatchObject({ nom: 'Entrée partagée', couleur: '#0a0' })
    expect(corps.userId).toBe(MOI)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})
