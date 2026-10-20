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
 * Revue 2026-10-20 — isolation des itinéraires techniques entre comptes :
 * liste (calée ou non), fiche, PUT et DELETE. L'ITP privé d'un autre compte
 * répond comme un ITP inexistant (404), avant même le 409 des références
 * sourcées ; aucun id d'un autre compte ne sort, ni sur l'ITP ni sur son espèce.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  zoneEffectiveUser: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/avis/stats-liste', () => ({ statsAvisPourRefs: vi.fn() }))
vi.mock('@/lib/terroir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terroir')>()
  return { ...actual, zoneEffectiveUser: mocks.zoneEffectiveUser }
})
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET as LISTE } from './route'
import { DELETE, GET, PUT } from './[id]/route'

const especePartagee = { id: 'cm-esp', nom: 'Espèce partagée', userId: AUTRE, partageCommunaute: true, famille: null }

const jeu = jeuReferentiel((id, nom) => ({
  id: `i-${id}`,
  nom,
  nomNormalise: nom.toLowerCase(),
  actif: true,
  zoneClimat: null,
  sourceRecordId: null,
  especeId: especePartagee.id,
  espece: especePartagee,
  semaineSemis: 10,
  semainePlantation: null,
  semaineRecolte: 30,
  _count: { cultures: 0, rotationsDetails: 0 },
}))
// La privée d'un autre compte porte une référence sourcée : le 409 « protégée »
// la trahissait avant même le contrôle d'auteur.
const lignes = (): Ligne[] => [jeu.gleba, jeu.moi, jeu.partagee, { ...jeu.privee, sourceRecordId: 'src-x' }]

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

let itp: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  mocks.zoneEffectiveUser.mockResolvedValue('oceanique')
  itp = delegueMemoire(lignes())
  mocks.db.iTP = itp
  mocks.db.culture = { count: vi.fn(async () => 0) }
})

describe('GET /api/itps', () => {
  it.each(['', '&calibre=1'])("sert Gleba, le sien et le partagé, sans id d'un autre compte (%s)", async (suffixe) => {
    const res = await LISTE(requete('GET', `/api/itps?pageSize=100${suffixe}`))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.data.map((i: Ligne) => [i.id, i.userId])).toEqual([
      ['i-gleba-1', null],
      ['i-cm-moi', MOI],
      ['i-cm-partagee', 'communaute'],
    ])
    expect(corps.data.every((i: { espece: Ligne }) => i.espece.userId === 'communaute')).toBe(true)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
    expect(JSON.stringify(corps)).not.toContain('secrète')
  })
})

describe('GET /api/itps/[id]', () => {
  it('fiche du partagé : marqueur sur l’ITP et sur son espèce', async () => {
    const res = await GET(requete('GET', '/api/itps/i-cm-partagee'), params('i-cm-partagee'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.userId).toBe('communaute')
    expect(corps.espece.userId).toBe('communaute')
  })

  it("le privé d'un autre compte répond 404, comme un inexistant", async () => {
    const res = await GET(requete('GET', '/api/itps/i-cm-privee'), params('i-cm-privee'))
    expect(res.status).toBe(404)
  })
})

describe('PUT / DELETE /api/itps/[id] — corps envoyés par OrigineControls', () => {
  it("PUT { partageCommunaute } sur le privé d'un autre : 404 (ni 403 ni 409), rien d'écrit", async () => {
    const privee = await PUT(requete('PUT', '/api/itps/i-cm-privee', { partageCommunaute: true }), params('i-cm-privee'))
    const absente = await PUT(requete('PUT', '/api/itps/x', { partageCommunaute: true }), params('x'))
    expect(privee.status).toBe(404)
    expect(absente.status).toBe(404)
    expect(itp.update).not.toHaveBeenCalled()
  })

  it('PUT sur le sien : 200, espèce masquée', async () => {
    const res = await PUT(requete('PUT', '/api/itps/i-cm-moi', { partageCommunaute: true }), params('i-cm-moi'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.userId).toBe(MOI)
    expect(corps.espece.userId).toBe('communaute')
  })

  it("DELETE sur le privé d'un autre : 404, rien supprimé ; sur le partagé : 403", async () => {
    const privee = await DELETE(requete('DELETE', '/api/itps/i-cm-privee'), params('i-cm-privee'))
    expect(privee.status).toBe(404)
    const partagee = await DELETE(requete('DELETE', '/api/itps/i-cm-partagee'), params('i-cm-partagee'))
    expect(partagee.status).toBe(403)
    expect(itp.delete).not.toHaveBeenCalled()
  })
})
