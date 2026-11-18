import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), arbres: vi.fn(), arbre: vi.fn(), greffes: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ default: {
  arbre: { findMany: mocks.arbres, findUnique: mocks.arbre },
  porteGreffe: { findMany: mocks.greffes },
  espece: { findMany: vi.fn(async () => []) },
} }))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromAchatArbre: vi.fn() }))

import { GET as liste } from './route'
import { GET as detail } from './[id]/route'

const tenant = 'exploitation-fictive'
const acteur = 'membre-fictif'
const reference = { id: 'pg-fictif', nom: 'Greffe fictive', vigueur: 3 }
const arbre = {
  id: 42, userId: tenant, nom: 'Arbre fictif', porteGreffeId: reference.id,
  portGreffe: null, especeId: null, espece: null, variete: null, _count: {},
}
const surfaces = [
  { nom: 'liste', lire: () => liste(new NextRequest('http://localhost/api/arbres')), ligne: (json: unknown) => (json as Record<string, unknown>[])[0] },
  { nom: 'détail', lire: () => detail(new NextRequest('http://localhost/api/arbres/42'), { params: Promise.resolve({ id: '42' }) }), ligne: (json: unknown) => json as Record<string, unknown> },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ error: null, session: { user: { id: tenant, acteurId: acteur } } })
  // Simule la relation Prisma uniquement quand le lecteur la demande.
  mocks.arbres.mockImplementation(async ({ include }) => [{ ...arbre, ...(include?.porteGreffeRef ? { porteGreffeRef: reference } : {}) }])
  mocks.arbre.mockImplementation(async ({ include }) => ({ ...arbre, ...(include?.porteGreffeRef ? { porteGreffeRef: reference } : {}) }))
})

describe.each(surfaces)('VT8 — $nom', ({ lire, ligne }) => {
  it.each([
    ['personnel', tenant, false, true],
    ['officiel', null, false, true],
    ['communautaire', 'autre-ferme-fictive', true, true],
    ['privé d’autrui', 'autre-ferme-fictive', false, false],
    ['privé de l’acteur membre', acteur, false, false],
  ] as const)('respecte le référentiel %s et conserve la liaison', async (_cas, auteur, partage, visible) => {
    mocks.greffes.mockImplementation(async ({ where }) => {
      expect(where).toEqual({ id: { in: [reference.id] }, OR: [{ userId: null }, { partageCommunaute: true }, { userId: tenant }] })
      return auteur === null || auteur === tenant || partage ? [reference] : []
    })
    const reponse = await lire()
    expect(reponse.status).toBe(200)
    expect(ligne(await reponse.json())).toMatchObject({
      id: arbre.id, porteGreffeId: reference.id, porteGreffeRef: visible ? reference : null,
    })
    expect(mocks.greffes).toHaveBeenCalledOnce()
    const requete = mocks.arbres.mock.calls[0]?.[0] ?? mocks.arbre.mock.calls[0]?.[0]
    expect(requete.where.userId).toBe(tenant)
  })

  it('masque le référentiel dès sa privatisation sans changer l’arbre', async () => {
    mocks.greffes.mockResolvedValueOnce([reference]).mockResolvedValueOnce([])
    expect(ligne(await (await lire()).json()).porteGreffeRef).toEqual(reference)
    expect(ligne(await (await lire()).json())).toMatchObject({ porteGreffeId: reference.id, porteGreffeRef: null })
    expect(arbre.porteGreffeId).toBe(reference.id)
  })

  it('préserve la saisie libre propre à l’arbre', async () => {
    const sansReference = { ...arbre, porteGreffeId: null, portGreffe: 'Texte historique fictif', porteGreffeRef: null }
    mocks.arbres.mockResolvedValue([sansReference])
    mocks.arbre.mockResolvedValue(sansReference)
    expect(ligne(await (await lire()).json())).toMatchObject({ porteGreffeId: null, portGreffe: 'Texte historique fictif', porteGreffeRef: null })
    expect(mocks.greffes).not.toHaveBeenCalled()
  })

  it('transmet le refus de module avant toute lecture', async () => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({ error: 'Module inaccessible' }, { status: 403 }) })
    expect((await lire()).status).toBe(403)
    expect(mocks.arbres).not.toHaveBeenCalled()
    expect(mocks.arbre).not.toHaveBeenCalled()
    expect(mocks.greffes).not.toHaveBeenCalled()
  })
})

it('renvoie 404 pour un arbre absent de l’exploitation', async () => {
  mocks.arbre.mockResolvedValue(null)
  expect((await surfaces[1].lire()).status).toBe(404)
  expect(mocks.arbre).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42, userId: tenant } }))
  expect(mocks.greffes).not.toHaveBeenCalled()
})
