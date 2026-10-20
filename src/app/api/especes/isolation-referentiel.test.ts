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
 * Revue 2026-10-20 — isolation des espèces entre comptes : l'espèce privée
 * d'un autre compte ne sort ni de la liste ni de la fiche, ne se modifie ni
 * ne se supprime, et répond comme une espèce inexistante (404, jamais 403).
 * Aucun id d'un autre compte ne sort (marqueur « communaute »).
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: mocks.requireAuthApi,
  requireAdminApi: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
// La fiche sert aussi le stock du compte (`calculerStocksNet`, 2026-10-20) :
// hors sujet ici, et ses requêtes n'ont pas de délégué mémoire.
vi.mock('@/lib/stocks-helpers', () => ({ calculerStocksNet: vi.fn(async () => ({})) }))

import { GET as LISTE } from './route'
import { DELETE, GET, PUT } from './[id]/route'

const especes = jeuReferentiel((id, nom) => ({ id, nom, type: 'legume', rendement: 2, uniteRendement: 'kg_m2' }))
const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom: `Variété ${nom}`, fournisseur: null }))
const itps = jeuReferentiel((id, nom) => ({ id: `i-${id}`, nom: `Itinéraire ${nom}` }))

/** Toutes les espèces portent les mêmes variétés et itinéraires des quatre origines. */
const lignesEspeces = (): Ligne[] =>
  Object.values(especes).map((e) => ({
    ...e,
    famille: null,
    varietes: Object.values(varietes),
    itps: Object.values(itps),
    _count: { cultures: 0, recoltes: 0, varietes: 0, itps: 0 },
  }))

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

let espece: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  espece = delegueMemoire(lignesEspeces())
  mocks.db.espece = espece
  mocks.db.userStockEspece = { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) }
  mocks.db.recolte = { groupBy: vi.fn(async () => []) }
})

describe('GET /api/especes — liste', () => {
  it("sert Gleba, l'espèce du compte et la partagée ; jamais la privée d'un autre ni son id", async () => {
    const res = await LISTE(requete('GET', '/api/especes?page=1&pageSize=100'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    const parId = Object.fromEntries(corps.data.map((e: Ligne) => [e.id, e.userId]))
    expect(parId).toEqual({ 'gleba-1': null, 'cm-moi': MOI, 'cm-partagee': 'communaute' })
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
    expect(JSON.stringify(corps)).not.toContain('secrète')
  })

  it('compte les variétés visibles du compte, pas le total tous comptes', async () => {
    await LISTE(requete('GET', '/api/especes'))
    const include = espece.findMany.mock.calls[0][0]?.include as { _count: { select: { varietes: unknown } } }
    expect(JSON.stringify(include._count.select.varietes)).toContain(MOI)
  })
})

describe('GET /api/especes/[id] — fiche', () => {
  it("la fiche ne liste ni la variété ni l'itinéraire privés d'un autre compte, sans id tiers", async () => {
    const res = await GET(requete('GET', '/api/especes/gleba-1'), params('gleba-1'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.userId).toBeNull()
    expect(corps.varietes.map((v: Ligne) => [v.id, v.userId])).toEqual([
      ['v-gleba-1', null],
      ['v-cm-moi', MOI],
      ['v-cm-partagee', 'communaute'],
    ])
    expect(corps.itps.map((i: Ligne) => i.id)).toEqual(['i-gleba-1', 'i-cm-moi', 'i-cm-partagee'])
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })

  it("compte les cultures et récoltes du compte, pas celles des autres", async () => {
    await GET(requete('GET', '/api/especes/gleba-1'), params('gleba-1'))
    const include = espece.findFirst.mock.calls[0][0]?.include as { _count: unknown }
    expect(include._count).toEqual({
      select: { cultures: { where: { userId: MOI } }, recoltes: { where: { userId: MOI } } },
    })
  })

  it("l'espèce privée d'un autre compte répond comme une espèce inexistante", async () => {
    const privee = await GET(requete('GET', '/api/especes/cm-privee'), params('cm-privee'))
    const absente = await GET(requete('GET', '/api/especes/inexistante'), params('inexistante'))
    expect(privee.status).toBe(404)
    expect(absente.status).toBe(404)
    expect(JSON.stringify(await privee.json())).not.toContain('secrète')
  })
})

describe('PUT / DELETE /api/especes/[id] — corps envoyés par OrigineControls', () => {
  it("PUT { partageCommunaute } sur la privée d'un autre : 404 comme une inexistante, rien d'écrit", async () => {
    const privee = await PUT(requete('PUT', '/api/especes/cm-privee', { partageCommunaute: true }), params('cm-privee'))
    const absente = await PUT(requete('PUT', '/api/especes/x', { partageCommunaute: true }), params('x'))
    expect(privee.status).toBe(404)
    expect(absente.status).toBe(404)
    expect(espece.update).not.toHaveBeenCalled()
  })

  it("PUT sur la partagée d'un autre reste refusé (403) ; sur la sienne, accepté sans id tiers", async () => {
    const partagee = await PUT(requete('PUT', '/api/especes/cm-partagee', { partageCommunaute: false }), params('cm-partagee'))
    expect(partagee.status).toBe(403)
    const mienne = await PUT(requete('PUT', '/api/especes/cm-moi', { partageCommunaute: true }), params('cm-moi'))
    expect(mienne.status).toBe(200)
    expect((await mienne.json()).userId).toBe(MOI)
    expect(espece.update).toHaveBeenCalledTimes(1)
  })

  it("DELETE sur la privée d'un autre : 404, rien supprimé", async () => {
    const res = await DELETE(requete('DELETE', '/api/especes/cm-privee'), params('cm-privee'))
    expect(res.status).toBe(404)
    expect(espece.delete).not.toHaveBeenCalled()
  })

  it("l'admin atteint toujours une entrée privée (modération : retrait de la communauté)", async () => {
    mocks.requireAuthApi.mockResolvedValue(sessionDe('admin-1', 'ADMIN'))
    const res = await PUT(requete('PUT', '/api/especes/cm-privee', { partageCommunaute: false }), params('cm-privee'))
    expect(res.status).toBe(200)
    expect((await res.json()).userId).toBe('communaute')
  })
})
