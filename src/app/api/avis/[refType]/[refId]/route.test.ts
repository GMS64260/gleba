import { NextRequest } from 'next/server'
import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTRE,
  MOI,
  correspond,
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
import { DELETE as retirerTemoignage } from '../../temoignages/[id]/route'
import { statsAvisPourRefs } from '@/lib/avis/stats-liste'

const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom, espece: { id: 'parent-public', userId: null, partageCommunaute: false } }))
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
  photos: [], temoignages: [], _count: { photos: 0, temoignages: 0 },
})

const params = (refId: string) => ({ params: Promise.resolve({ refType: 'VARIETE', refId }) })
const requete = (method: string, refId: string, body?: object) =>
  new NextRequest(`http://localhost/api/avis/VARIETE/${refId}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

/** Le faux délégué applique le filtre SQL avant skip/take et le comptage. */
function correspondAvis(ligne: Ligne, where: unknown): boolean {
  if (!where || typeof where !== 'object') return true
  return Object.entries(where).every(([key, filtre]) => {
    if (key === 'AND') return (Array.isArray(filtre) ? filtre : [filtre]).every(f => correspondAvis(ligne, f))
    if (key === 'OR') return (filtre as unknown[]).some(f => correspondAvis(ligne, f))
    if (filtre && typeof filtre === 'object') {
      const f = filtre as Record<string, unknown>
      if ('some' in f) return Array.isArray(ligne[key]) && (ligne[key] as Ligne[]).some(r => correspondAvis(r, f.some))
      if ('path' in f) {
        const valeur = (f.path as string[]).reduce<unknown>((v, k) => v && typeof v === 'object' ? (v as Ligne)[k] : undefined, ligne[key])
        return typeof valeur === 'number' && valeur >= (f.gte as number) && valeur <= (f.lte as number)
      }
    }
    return correspond(ligne, { [key]: filtre })
  })
}
function avisEnMemoire(lignes: Ligne[]) {
  const chercher = (where: unknown) => lignes.filter(r => correspondAvis(r, where))
  mocks.db.avis = {
    findMany: vi.fn(async ({ where, skip = 0, take }: { where: unknown; skip?: number; take?: number }) => chercher(where).slice(skip, take === undefined ? undefined : skip + take)),
    count: vi.fn(async ({ where }: { where: unknown }) => chercher(where).length),
    findUnique: vi.fn(async ({ where }: { where: { refType_refId_userId: Ligne } }) => chercher(where.refType_refId_userId)[0] ?? null),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  mocks.rendementReel.mockResolvedValue(new Map())
  mocks.db.variete = delegueMemoire(Object.values(varietes) as Ligne[])
  mocks.db.user = { findUnique: vi.fn(async () => ({ id: MOI, active: true, email: 'test@example.test', role: 'USER' })) }
  mocks.db.$queryRaw = vi.fn(async () => [{ id: MOI }])
  mocks.db.$transaction = vi.fn(async (fn: (tx: typeof mocks.db) => Promise<unknown>) => fn(mocks.db))
  mocks.db.temoignageRecolte = { groupBy: vi.fn(async () => []) }
  mocks.db.avis = {
    findMany: vi.fn(async ({ where }: { where: { refId: string } }) => [avisDe(where.refId)]),
    findUnique: vi.fn(async () => null), count: vi.fn(async () => 1),
    findUniqueOrThrow: vi.fn(async () => ({ ...avisDe('v-gleba-1'), userId: MOI })),
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
    expect(mocks.rendementReel).not.toHaveBeenCalled()
  })

  it('retirer le dernier témoignage masque son parent vide aux autres comptes, tout en gardant monAvis éditable', async () => {
    const parent: Ligne = { ...avisDe('v-cm-partagee'), reprend: null, commentaire: null, notes: { rendement: null },
      temoignages: [{ id: 'temoin', dateRecolte: new Date('2026-10-01'), quantite: null, unite: null, commentaire: null, photos: [], createdAt: new Date('2026-10-01') }],
      _count: { photos: 0, temoignages: 1 } }
    avisEnMemoire([parent])
    const avant = await (await GET(requete('GET', 'v-cm-partagee'), params('v-cm-partagee'))).json()
    expect(avant.data.total).toBe(1)
    expect(avant.data.avis).toHaveLength(1)
    expect(avant.data.stats.nbAvis).toBe(0)

    mocks.requireAuthApi.mockResolvedValue(sessionDe(AUTRE))
    mocks.db.temoignageRecolte = { deleteMany: vi.fn(async ({ where }: { where: { id: string; avis: { userId: string } } }) => {
      expect(where).toEqual({ id: 'temoin', avis: { userId: AUTRE } })
      parent.temoignages = []; parent._count = { photos: 0, temoignages: 0 }
      return { count: 1 }
    }), groupBy: vi.fn(async () => []) }
    const retrait = await retirerTemoignage(new Request('http://localhost/api/avis/temoignages/temoin', { method: 'DELETE' }), { params: Promise.resolve({ id: 'temoin' }) })
    expect(retrait.status).toBe(200)

    mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
    const apres = await (await GET(requete('GET', 'v-cm-partagee'), params('v-cm-partagee'))).json()
    expect(apres.data).toMatchObject({ avis: [], total: 0, monAvis: null })
    mocks.requireAuthApi.mockResolvedValue(sessionDe(AUTRE))
    const personnel = await (await GET(requete('GET', 'v-cm-partagee'), params('v-cm-partagee'))).json()
    expect(personnel.data.monAvis.id).toBe(parent.id)
  })

  it('écarte les parents vides avant pagination et conserve une vraie note au-delà des 20 premiers supports', async () => {
    const supports: Ligne[] = Array.from({ length: 21 }, (_, i) => ({ ...avisDe('v-cm-partagee'), id: `vide-${i}`, reprend: null, commentaire: null, notes: {} }))
    supports.push({ ...avisDe('v-cm-partagee'), id: 'note', reprend: null, commentaire: null, notes: { rendement: 4 } })
    avisEnMemoire(supports)
    const corps = await (await GET(requete('GET', 'v-cm-partagee'), params('v-cm-partagee'))).json()
    expect(corps.data.total).toBe(1)
    expect(corps.data.avis.map((a: { id: string }) => a.id)).toEqual(['note'])
    expect(corps.data.stats).toMatchObject({ nbAvis: 1, noteMoyenne: 4 })
  })

  it('les statistiques des listes comptent les photos directes mais pas les simples supports de témoignages', async () => {
    const vide = { ...avisDe('v-cm-partagee'), reprend: null, commentaire: null, notes: { rendement: null } }
    avisEnMemoire([vide, { ...vide, id: 'support', temoignages: [{ id: 'temoin' }] },
      { ...vide, id: 'photo', photos: [{ id: 'photo' }] }, { ...vide, id: 'note', notes: { rendement: 4 } },
      { ...vide, id: 'reprise', reprend: false }])
    const stats = await statsAvisPourRefs(mocks.db as unknown as PrismaClient, 'VARIETE', ['v-cm-partagee'])
    expect(stats.get('v-cm-partagee')).toMatchObject({ nbAvis: 3, noteMoyenne: 4, tauxReprise: 0 })
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
