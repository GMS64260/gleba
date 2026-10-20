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
 * Revue 2026-10-20 — isolation des variétés entre comptes : liste, PUT et
 * DELETE (corps envoyés par OrigineControls). La variété privée d'un autre
 * compte ne sort pas et répond comme une variété inexistante ; aucun id
 * d'un autre compte ne sort, ni sur la variété ni sur son espèce.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: mocks.requireAuthApi,
  requireAdminApi: vi.fn(),
}))
vi.mock('@/lib/avis/stats-liste', () => ({ statsAvisPourRefs: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET } from './route'
import { DELETE, PUT } from './[id]/route'

const especePartagee = { id: 'cm-esp-partagee', nom: 'Espèce partagée', userId: AUTRE, partageCommunaute: true, famille: null }
const especePrivee = { id: 'cm-esp-privee', nom: 'Espèce privée secrète', userId: AUTRE, partageCommunaute: false, famille: null }

const jeu = jeuReferentiel((id, nom) => ({
  id: `v-${id}`,
  nom,
  especeId: especePartagee.id,
  espece: especePartagee,
  fournisseur: null,
  userStocks: [],
  _count: { cultures: 0 },
}))
/** Variété « Non spécifiée » du catalogue rattachée à l'espèce privée d'un autre compte. */
const surEspecePrivee = { ...jeu.gleba, id: 'v-non-specifiee', espece: especePrivee, especeId: especePrivee.id }

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

let variete: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  variete = delegueMemoire([...Object.values(jeu), surEspecePrivee] as Ligne[])
  mocks.db.variete = variete
  mocks.db.userStockVariete = { findUnique: vi.fn(async () => null) }
  mocks.db.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(mocks.db))
})

describe('GET /api/varietes', () => {
  it("sert Gleba, la variété du compte et la partagée, sans aucun id d'un autre compte", async () => {
    const res = await GET(requete('GET', '/api/varietes?pageSize=100'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.data.map((v: Ligne) => [v.id, v.userId])).toEqual([
      ['v-gleba-1', null],
      ['v-cm-moi', MOI],
      ['v-cm-partagee', 'communaute'],
    ])
    // L'espèce embarquée, partagée par un autre compte, porte le marqueur.
    expect(corps.data[0].espece.userId).toBe('communaute')
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
    expect(JSON.stringify(corps)).not.toContain('secrète')
  })
})

describe('PUT / DELETE /api/varietes/[id]', () => {
  it("PUT { partageCommunaute } sur la privée d'un autre : 404 comme une inexistante", async () => {
    const privee = await PUT(requete('PUT', '/api/varietes/v-cm-privee', { partageCommunaute: true }), params('v-cm-privee'))
    const absente = await PUT(requete('PUT', '/api/varietes/x', { partageCommunaute: true }), params('x'))
    expect(privee.status).toBe(404)
    expect(absente.status).toBe(404)
    expect(variete.update).not.toHaveBeenCalled()
  })

  it('PUT : 403 sur la partagée d’un autre, 200 sur la sienne avec une espèce masquée', async () => {
    const partagee = await PUT(requete('PUT', '/api/varietes/v-cm-partagee', { partageCommunaute: false }), params('v-cm-partagee'))
    expect(partagee.status).toBe(403)
    const mienne = await PUT(requete('PUT', '/api/varietes/v-cm-moi', { partageCommunaute: true }), params('v-cm-moi'))
    expect(mienne.status).toBe(200)
    const corps = await mienne.json()
    expect(corps.userId).toBe(MOI)
    expect(corps.espece.userId).toBe('communaute')
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })

  it("DELETE sur la privée d'un autre : 404, rien supprimé", async () => {
    const res = await DELETE(requete('DELETE', '/api/varietes/v-cm-privee'), params('v-cm-privee'))
    expect(res.status).toBe(404)
    expect(variete.delete).not.toHaveBeenCalled()
  })
})
