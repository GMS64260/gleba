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
 * Revue 2026-10-20 — avis sur une entrée de référentiel : l'entrée privée
 * d'un autre compte répond comme une entrée inexistante. Ses avis (auteur,
 * commentaire) ne sortent pas et on ne peut pas la noter ; le catalogue Gleba,
 * l'entrée du compte et l'entrée partagée restent notables.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  rendementReel: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/avis/data-driven', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/avis/data-driven')>()
  return { ...actual, rendementReel: mocks.rendementReel }
})
vi.mock('@/lib/terroir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terroir')>()
  return { ...actual, terroirDeUser: vi.fn(async () => ({ typeSol: null, zoneClimat: null, codePostal: null })) }
})
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET, POST } from './route'

const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom }))
const avisDe = (refId: string) => ({
  id: `a-${refId}`,
  refType: 'VARIETE',
  refId,
  userId: AUTRE,
  user: { id: AUTRE, name: 'Auteur tiers' },
  reprend: true,
  notes: {},
  commentaire: 'Commentaire secret',
  contexteTypeSol: null,
  contexteZoneClimat: null,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
})

const params = (refId: string) => ({ params: Promise.resolve({ refType: 'VARIETE', refId }) })
const requete = (method: string, refId: string, body?: object) =>
  new NextRequest(`http://localhost/api/avis/VARIETE/${refId}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  mocks.rendementReel.mockResolvedValue(new Map())
  mocks.db.variete = delegueMemoire(Object.values(varietes) as Ligne[])
  mocks.db.avis = {
    findMany: vi.fn(async ({ where }: { where: { refId: string } }) => [avisDe(where.refId)]),
    upsert: vi.fn(async ({ create }: { create: Ligne }) => ({ id: 'nouvel-avis', ...create })),
  }
})

describe('GET /api/avis/VARIETE/[refId]', () => {
  it("variété privée d'un autre compte : même réponse qu'une variété inexistante, aucun avis", async () => {
    const privee = await (await GET(requete('GET', 'v-cm-privee'), params('v-cm-privee'))).json()
    const absente = await (await GET(requete('GET', 'inexistante'), params('inexistante'))).json()
    expect(privee.data.avis).toEqual([])
    expect(JSON.stringify(privee)).not.toContain('secret')
    expect(JSON.stringify(privee)).toBe(JSON.stringify(absente))
  })

  it('variété partagée : ses avis sortent toujours', async () => {
    const corps = await (await GET(requete('GET', 'v-cm-partagee'), params('v-cm-partagee'))).json()
    expect(corps.data.avis).toHaveLength(1)
  })
})

describe('POST /api/avis/VARIETE/[refId] — corps du panneau d’avis', () => {
  const corps = { reprend: true, notes: {}, commentaire: 'Bonne tenue' }

  it("refuse en 404 la variété privée d'un autre compte, comme une inexistante", async () => {
    const privee = await POST(requete('POST', 'v-cm-privee', corps), params('v-cm-privee'))
    const absente = await POST(requete('POST', 'inexistante', corps), params('inexistante'))
    expect([privee.status, absente.status]).toEqual([404, 404])
  })

  it('accepte le catalogue Gleba, la variété du compte et la partagée', async () => {
    for (const id of ['v-gleba-1', 'v-cm-moi', 'v-cm-partagee']) {
      const res = await POST(requete('POST', id, corps), params(id))
      expect(res.status).toBe(201)
    }
  })
})
