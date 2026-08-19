import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  especeFindFirst: vi.fn(),
  especeFindUnique: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    iTP: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      update: mocks.update,
    },
    espece: { findFirst: mocks.especeFindFirst, findUnique: mocks.especeFindUnique },
    culture: { count: vi.fn().mockResolvedValue(0) },
  },
}))

import { PUT } from './route'

const params = (id: string) => ({ params: Promise.resolve({ id }) })

function requete(body: unknown) {
  return new NextRequest('http://localhost/api/itps/x', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const ITP_PERSO = {
  id: 'cmperso1',
  nom: 'TEST Marc Phacelie v7',
  nomNormalise: 'test marc phacelie v7',
  userId: 'user-1',
  especeId: null,
  sourceRecordId: null,
  semainePlantation: null,
}

describe('PUT /api/itps/[id] — renommage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'USER' } },
    })
    mocks.findUnique.mockResolvedValue(ITP_PERSO)
    mocks.findFirst.mockResolvedValue(null)
    mocks.findMany.mockResolvedValue([])
    mocks.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...ITP_PERSO,
      ...data,
    }))
  })

  it("écrit le libellé tel que saisi et recalcule la clé de dédup", async () => {
    // Le nom de cet ITP avait été écrasé avant le correctif QA cmswxyuoi ;
    // aucun écran ne permettait de le corriger. La clé doit suivre le nom, sinon
    // la recherche normalisée et la détection de doublons deviennent fausses.
    const res = await PUT(requete({ nom: '  TEST-Marc-Phacélie-v7  ' }), params('cmperso1'))

    expect(res.status).toBe(200)
    const data = mocks.update.mock.calls[0][0].data
    expect(data.nom).toBe('TEST-Marc-Phacélie-v7')
    expect(data.nomNormalise).toBe('test marc phacelie v7')
  })

  it("ne touche jamais à l'identifiant technique", async () => {
    await PUT(requete({ nom: 'Phacélie fin de saison' }), params('cmperso1'))

    const appel = mocks.update.mock.calls[0][0]
    expect(appel.where).toEqual({ id: 'cmperso1' })
    expect(appel.data.id).toBeUndefined()
  })

  it('refuse un nom déjà utilisé dans le même périmètre', async () => {
    mocks.findFirst.mockResolvedValueOnce({ id: 'cmperso2', nom: 'Phacélie automne' })

    const res = await PUT(requete({ nom: 'Phacelie-automne' }), params('cmperso1'))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Phacélie automne')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("ne cherche ni conflit ni homonyme quand la clé ne change pas", async () => {
    // Enregistrer la fiche sans toucher au nom ne doit produire ni 409 contre
    // soi-même, ni rappel d'homonyme à chaque sauvegarde.
    const res = await PUT(requete({ nom: 'TEST  Marc Phacelie v7', nbRangs: 3 }), params('cmperso1'))

    expect(res.status).toBe(200)
    expect(mocks.findFirst).not.toHaveBeenCalled()
    expect((await res.json()).doublonPotentiel).toBeUndefined()
  })

  it('refuse un nom vide', async () => {
    const res = await PUT(requete({ nom: '   ' }), params('cmperso1'))

    expect(res.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("laisse la référence sourcée intacte", async () => {
    mocks.findUnique.mockResolvedValue({ ...ITP_PERSO, sourceRecordId: 'inrae-x' })

    const res = await PUT(requete({ nom: 'Autre nom' }), params('cmperso1'))

    expect(res.status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("refuse de modifier l'ITP d'un autre membre", async () => {
    mocks.findUnique.mockResolvedValue({ ...ITP_PERSO, userId: 'user-2' })

    const res = await PUT(requete({ nom: 'Détournement' }), params('cmperso1'))

    expect(res.status).toBe(403)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('signale sans bloquer un homonyme du catalogue visible', async () => {
    // 1er findFirst : conflit dans le périmètre d'unicité → aucun.
    // 2e findFirst : homonyme visible ailleurs (catalogue officiel).
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'Phacelie-printemps',
      nom: 'Phacelie-printemps',
    })

    const res = await PUT(requete({ nom: 'Phacelie printemps' }), params('cmperso1'))

    expect(res.status).toBe(200)
    expect((await res.json()).doublonPotentiel).toEqual({
      id: 'Phacelie-printemps',
      nom: 'Phacelie-printemps',
    })
  })
})
