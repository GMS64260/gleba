import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  especeFindMany: vi.fn(),
  especeCreate: vi.fn(),
  especeFindUnique: vi.fn(),
  especeUpdate: vi.fn(),
  animalGroupBy: vi.fn(),
  chargerCheptelEnStock: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({
  default: {
    especeAnimale: {
      findMany: mocks.especeFindMany,
      create: mocks.especeCreate,
      findUnique: mocks.especeFindUnique,
      // Revue 2026-10-20 — PUT/DELETE lisent la cible par `findFirst` scopé.
      findFirst: mocks.especeFindUnique,
      update: mocks.especeUpdate,
    },
    animal: { groupBy: mocks.animalGroupBy },
  },
}))
vi.mock('@/lib/elevage/stock-cheptel', () => ({ chargerCheptelEnStock: mocks.chargerCheptelEnStock }))

import { GET, POST } from './route'
import { PUT } from './[id]/route'
import { rendementCarcasseDepuisSaisie } from '@/lib/elevage/rendement-carcasse'

const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

/** Corps envoyé par EspecesTab pour le profil du ticket, rendement saisi « 65 ». */
const corpsEcran = (rendementSaisi: string) => {
  const rendement = rendementCarcasseDepuisSaisie(rendementSaisi)
  if (!rendement.ok) throw new Error(rendement.erreur)
  return {
    id: 'v8_julien_canard_20_octobre',
    nom: 'v8-Julien canard 20 octobre',
    type: 'volaille',
    filiere: 'rente',
    production: 'mixte',
    couleur: '#F59E0B',
    description: null,
    dureeGestation: null,
    dureeCouvaison: null,
    dureeElevage: null,
    poidsAdulte: 3,
    rendementCarcasse: rendement.ratio,
    ponteAnnuelle: null,
    consommationJour: null,
    prixAchat: null,
    partageCommunaute: false,
  }
}

describe('profils d’élevage — rendement carcasse (QA cmvgeif10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'demo', role: 'USER' } } })
    mocks.especeCreate.mockImplementation(async ({ data }: { data: object }) => data)
    mocks.especeUpdate.mockImplementation(async ({ data }: { data: object }) => data)
    mocks.animalGroupBy.mockResolvedValue([])
    mocks.chargerCheptelEnStock.mockResolvedValue({ individuels: [], lots: [] })
  })

  it('POST : « 65 » saisi à l’écran crée le profil avec le ratio 0,65', async () => {
    const res = await POST(requete('POST', '/api/elevage/especes-animales', corpsEcran('65')))
    expect(res.status).toBe(201)
    expect(mocks.especeCreate.mock.calls[0][0].data.rendementCarcasse).toBe(0.65)
  })

  it('POST : un pourcentage brut est refusé en nommant le champ et l’unité', async () => {
    const res = await POST(requete('POST', '/api/elevage/especes-animales', { ...corpsEcran('65'), rendementCarcasse: 65 }))
    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.champ).toBe('rendementCarcasse')
    expect(corps.error).toMatch(/Rendement carcasse.*ratio/)
    expect(mocks.especeCreate).not.toHaveBeenCalled()
  })

  it('POST : un ratio sous 1 % (0,65 saisi par habitude puis divisé) est refusé', async () => {
    const res = await POST(requete('POST', '/api/elevage/especes-animales', { ...corpsEcran('65'), rendementCarcasse: 0.0065 }))
    expect(res.status).toBe(400)
    expect((await res.json()).champ).toBe('rendementCarcasse')
    expect(mocks.especeCreate).not.toHaveBeenCalled()
  })

  it('PUT : même règle à la modification, null efface', async () => {
    mocks.especeFindUnique.mockResolvedValue({ id: 'v8_julien_canard_20_octobre', userId: 'demo' })
    const params = { params: Promise.resolve({ id: 'v8_julien_canard_20_octobre' }) }

    const refus = await PUT(requete('PUT', '/api/elevage/especes-animales/x', { rendementCarcasse: 72 }), params)
    expect(refus.status).toBe(400)
    expect((await refus.json()).champ).toBe('rendementCarcasse')
    expect(mocks.especeUpdate).not.toHaveBeenCalled()

    const ok = await PUT(requete('PUT', '/api/elevage/especes-animales/x', corpsEcran('72')), params)
    expect(ok.status).toBe(200)
    expect(mocks.especeUpdate.mock.calls[0][0].data.rendementCarcasse).toBe(0.72)

    await PUT(requete('PUT', '/api/elevage/especes-animales/x', corpsEcran('')), params)
    expect(mocks.especeUpdate.mock.calls[1][0].data.rendementCarcasse).toBeNull()
  })

  it('GET : une ancienne entrée du catalogue en pourcentage est rendue en ratio', async () => {
    mocks.especeFindMany.mockResolvedValue([
      { id: 'cochon_gascon', nom: 'Cochon Gascon', rendementCarcasse: 75 },
      { id: 'poule_pondeuse', nom: 'Poule pondeuse', rendementCarcasse: 0.65 },
      { id: 'chat', nom: 'Chat', rendementCarcasse: null },
    ])
    const res = await GET(requete('GET', '/api/elevage/especes-animales'))
    const { data } = await res.json()
    expect(data.map((e: { rendementCarcasse: number | null }) => e.rendementCarcasse)).toEqual([0.75, 0.65, null])
  })

  // Revue 2026-10-20 — `effectifTotal` lit l'effectif reconstitué des lots
  // (écran Lots) et n'y rajoute que les fiches hors lot actif.
  it('GET : effectifTotal = fiches hors lot actif + effectif reconstitué des lots', async () => {
    mocks.especeFindMany.mockResolvedValue([{ id: 'pintade', nom: 'Pintade perle', rendementCarcasse: 0.72 }])
    mocks.animalGroupBy.mockResolvedValue([{ especeAnimaleId: 'pintade', _count: 3 }])
    mocks.chargerCheptelEnStock.mockResolvedValue({
      individuels: [{ especeAnimaleId: 'pintade', tetes: 2 }],
      lots: [{ id: 71, especeAnimaleId: 'pintade', nom: 'Pintades perle A3 1708', tetes: 4 }],
    })
    const { data } = await (await GET(requete('GET', '/api/elevage/especes-animales'))).json()
    expect(data[0]._count).toEqual({ animaux: 3, lots: 1 })
    expect(data[0].effectifTotal).toBe(6)
  })
})
