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
  itpDelete: vi.fn(),
  cultureGroupBy: vi.fn(),
  rotationDetailFindMany: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    iTP: {
      findUnique: mocks.findUnique,
      // Revue 2026-10-20 — la cible du PUT est lue par un `findFirst` scopé
      // sans `select` ni `include` (whereReferentielCible) : elle garde la
      // réponse de `mocks.findUnique`. Les contrôles de nom (`select`) et la
      // cible du DELETE (`include`) passent par `mocks.findFirst`.
      findFirst: (args: { select?: unknown; include?: unknown }) =>
        args.select || args.include ? mocks.findFirst(args) : mocks.findUnique(args),
      findMany: mocks.findMany,
      update: mocks.update,
      delete: mocks.itpDelete,
    },
    espece: { findFirst: mocks.especeFindFirst, findUnique: mocks.especeFindUnique },
    culture: { count: vi.fn().mockResolvedValue(0), groupBy: mocks.cultureGroupBy },
    rotationDetail: { findMany: mocks.rotationDetailFindMany },
  },
}))

import { DELETE, PUT } from './route'

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

  it("refuse de modifier l'ITP partagé d'un autre membre", async () => {
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

/**
 * 2026-10-20 — la liste et la fiche des ITP refusaient seules la suppression
 * d'après leur propre compteur (« utilise dans 2 culture(s) »). Elles tentent
 * désormais le DELETE et affichent ce refus, qui nomme ce qui bloque.
 */
describe('DELETE /api/itps/[id] — refus qui nomme ce qui retient l’ITP', () => {
  const supprimer = () =>
    DELETE(new NextRequest('http://localhost/api/itps/cmperso1', { method: 'DELETE' }), params('cmperso1'))

  beforeEach(() => {
    vi.clearAllMocks()
    // Aucune réponse « Once » héritée d'un autre bloc.
    mocks.findFirst.mockReset()
    mocks.findUnique.mockReset()
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'USER' } },
    })
    mocks.cultureGroupBy.mockResolvedValue([])
    mocks.rotationDetailFindMany.mockResolvedValue([])
  })

  it('refuse en 409 en nommant années des cultures du compte, cultures des autres et rotations', async () => {
    mocks.findFirst.mockResolvedValue({ ...ITP_PERSO, _count: { cultures: 5, rotationsDetails: 2 } })
    mocks.cultureGroupBy.mockResolvedValue([
      { annee: 2025, _count: { _all: 1 } },
      { annee: 2026, _count: { _all: 2 } },
      { annee: null, _count: { _all: 1 } },
    ])
    mocks.rotationDetailFindMany.mockResolvedValue([{ rotationId: 'Rotation courte' }])

    const res = await supprimer()
    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps.error).toBe(
      'Impossible de supprimer cet itinéraire : il est utilisé par 4 de vos cultures (années 2025 et 2026, et 1 sans année), ' +
        "1 culture d'autres membres de la communauté et 2 étapes de rotation (rotation « Rotation courte »).",
    )
    expect(corps.details).toMatchObject({ cultures: 5, culturesDuCompte: 4, culturesAutresMembres: 1, rotations: 2 })
    // Années lues dans le seul compte.
    expect(mocks.cultureGroupBy.mock.calls[0][0].where).toEqual({ itpId: 'cmperso1', userId: 'user-1' })
    expect(mocks.itpDelete).not.toHaveBeenCalled()
  })

  it('refuse pour les seules cultures d’autres membres (compteur de l’écran à 0)', async () => {
    mocks.findFirst.mockResolvedValue({ ...ITP_PERSO, _count: { cultures: 2, rotationsDetails: 0 } })
    const res = await supprimer()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(
      "Impossible de supprimer cet itinéraire : il est utilisé par 2 cultures d'autres membres de la communauté.",
    )
    expect(mocks.itpDelete).not.toHaveBeenCalled()
  })

  it('supprime un ITP que rien ne retient', async () => {
    mocks.findFirst.mockResolvedValue({ ...ITP_PERSO, _count: { cultures: 0, rotationsDetails: 0 } })
    mocks.itpDelete.mockResolvedValue({})
    const res = await supprimer()
    expect(res.status).toBe(200)
    expect(mocks.itpDelete).toHaveBeenCalledWith({ where: { id: 'cmperso1' } })
    expect(mocks.cultureGroupBy).not.toHaveBeenCalled()
  })
})
