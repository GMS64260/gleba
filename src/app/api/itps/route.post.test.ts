import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  especeFindFirst: vi.fn(),
  zoneEffectiveUser: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    iTP: { findFirst: mocks.findFirst, findMany: mocks.findMany, create: mocks.create },
    espece: { findFirst: mocks.especeFindFirst },
  },
}))
vi.mock('@/lib/terroir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terroir')>()
  return { ...actual, zoneEffectiveUser: mocks.zoneEffectiveUser }
})
vi.mock('@/lib/avis/stats-liste', () => ({ statsAvisPourRefs: vi.fn() }))

import { POST } from './route'

function requete(body: unknown) {
  return new NextRequest('http://localhost/api/itps', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Erreur telle que Prisma la lève sur une violation d'unicité. */
function p2002(target: unknown) {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta: { target } })
}

describe('POST /api/itps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.requireAuthApi.mockResolvedValue({
      error: null,
      session: { user: { id: 'user-1', role: 'USER' } },
    })
    // `clearAllMocks` garde les réponses « une fois » non consommées.
    mocks.findFirst.mockReset()
    mocks.create.mockReset()
    mocks.findFirst.mockResolvedValue(null)
    mocks.findMany.mockResolvedValue([])
    mocks.zoneEffectiveUser.mockResolvedValue('oceanique')
    mocks.especeFindFirst.mockResolvedValue({
      id: 'cmespece1',
      nom: 'Tomate ancienne',
      typeCultureSemis: 'pepiniere_puis_repiquage',
    })
    mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'cmitp1',
      ...data,
      espece: null,
    }))
  })

  it('refuse un nom fait uniquement d’espaces au lieu de créer un ITP sans nom', async () => {
    const res = await POST(requete({ id: '   ' }))

    expect(res.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/nom/i)
  })

  it('traduit la collision de période en 409 qui nomme l’itinéraire existant', async () => {
    // Forme réelle de `meta.target` pour un index sur expressions : des
    // fragments de colonnes, jamais le nom de l'index.
    mocks.create.mockRejectedValue(
      p2002(['COALESCE(user_id', "'<officiel>'::text)", 'espece', 'COALESCE(s_semis', '-1)', 'COALESCE(s_plantation', '-1)', 'COALESCE(s_recolte', '-1)'])
    )
    // Contrôle de nom (aucun conflit), puis recherche de l'ITP de même période.
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'cmexistant', nom: 'Tomate sous abri' })

    const res = await POST(
      requete({
        id: 'Ma tomate',
        especeId: 'cmespece1',
        semaineSemis: 7,
        semainePlantation: 11,
        semaineRecolte: 27,
        typePlanche: 'Sous abri',
      })
    )

    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps.error).toContain('Tomate sous abri')
    expect(corps.conflit).toBe('cmexistant')
    // La recherche porte sur l'exploitation et sur les valeurs saisies.
    expect(mocks.findFirst.mock.calls[1][0].where).toMatchObject({
      userId: 'user-1',
      especeId: 'cmespece1',
      semaineSemis: 7,
      semainePlantation: 11,
      semaineRecolte: 27,
      typePlanche: 'Sous abri',
    })
  })

  it('répond 409 quand la cible porte le nom de l’index (corps déjà lu une fois)', async () => {
    // `request.clone()` après `request.json()` levait dans le `catch` : la
    // requête se terminait en erreur non rattrapée.
    mocks.create.mockRejectedValue(p2002('itps_periode_unique_idx'))

    const res = await POST(
      requete({ id: 'Ma tomate', especeId: 'cmespece1', semaineSemis: 7, semaineRecolte: 27 })
    )

    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/même période/)
  })

  it('reconnaît la collision de période même quand la cible est illisible', async () => {
    mocks.create.mockRejectedValue(p2002('(not available)'))
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'cmexistant', nom: 'Tomate sous abri' })

    const res = await POST(
      requete({ id: 'Ma tomate', especeId: 'cmespece1', semaineSemis: 7, semaineRecolte: 27 })
    )

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Tomate sous abri')
  })

  it('laisse en 500 une violation d’unicité qui ne concerne pas la période', async () => {
    mocks.create.mockRejectedValue(p2002(['user_id', 'nom_normalise']))

    const res = await POST(
      requete({ id: 'Ma tomate', especeId: 'cmespece1', semaineSemis: 7, semaineRecolte: 27 })
    )

    expect(res.status).toBe(500)
  })

  it('refuse en 400 un cycle semis-récolte de moins de 4 semaines (règle du trigger)', async () => {
    const res = await POST(
      requete({ id: 'Radis éclair', especeId: 'cmespece1', semaineSemis: 10, semaineRecolte: 12 })
    )

    expect(res.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/4 semaines/)
  })

  it('refuse en 400 une plantation la semaine du semis pour une espèce élevée en pépinière', async () => {
    const res = await POST(
      requete({
        id: 'Tomate pressée',
        especeId: 'cmespece1',
        semaineSemis: 10,
        semainePlantation: 10,
        semaineRecolte: 30,
      })
    )

    expect(res.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
    expect((await res.json()).error).toMatch(/plantation/i)
  })

  it('accepte un cycle à cheval sur deux années (semis S50, récolte S6)', async () => {
    const res = await POST(
      requete({ id: 'Mâche hiver', especeId: 'cmespece1', semaineSemis: 50, semaineRecolte: 6 })
    )

    expect(res.status).toBe(201)
  })

  it('traduit en 400 le refus du trigger qui aurait échappé au contrôle', async () => {
    mocks.create.mockRejectedValue(
      new Error(
        'Invalid `prisma.iTP.create()` invocation: Raw query failed. Code: `P0001`. Message: `ITP cmitp1: récolte S12 trop proche du semis S10 (< 4 semaines)`'
      )
    )
    // Espèce non lue (sans semaine de semis au contrôle) : seul le repli parle.
    mocks.especeFindFirst.mockResolvedValue({ id: 'cmespece1', nom: 'Tomate ancienne', typeCultureSemis: null })

    const res = await POST(requete({ id: 'Radis éclair', especeId: 'cmespece1', semaineRecolte: 12 }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/4 semaines/)
  })

  it('nomme l’espèce par son libellé, pas par son identifiant technique', async () => {
    mocks.especeFindFirst.mockResolvedValue({
      id: 'cmespece1',
      nom: 'Carotte de Guérande',
      typeCultureSemis: 'semis_direct',
    })

    const res = await POST(
      requete({ id: 'Carotte', especeId: 'cmespece1', semaineSemis: 10, semainePlantation: 14 })
    )

    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.error).toContain('Carotte de Guérande')
    expect(corps.error).not.toContain('cmespece1')
  })
})
