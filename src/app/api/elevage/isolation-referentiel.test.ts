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
 * Revue 2026-10-20 — isolation des référentiels d'élevage entre comptes
 * (profils d'espèce, races, délais des produits vétérinaires). L'entrée privée
 * d'un autre compte ne sort pas, ne se modifie ni ne se supprime, et répond
 * comme une entrée inexistante ; aucun id d'un autre compte ne sort.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  chargerCheptelEnStock: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/avis/stats-liste', () => ({ statsAvisPourRefs: vi.fn() }))
vi.mock('@/lib/elevage/stock-cheptel', () => ({ chargerCheptelEnStock: mocks.chargerCheptelEnStock }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET as LISTE_ESPECES } from './especes-animales/route'
import { DELETE as DELETE_ESPECE, PUT as PUT_ESPECE } from './especes-animales/[id]/route'
import { DELETE as DELETE_RACE_QUERY, GET as LISTE_RACES } from './races/route'
import { DELETE as DELETE_RACE, PUT as PUT_RACE } from './races/[id]/route'
import { GET as PRODUITS } from './produits-veterinaires/route'

const especes = jeuReferentiel((id, nom) => ({
  id: `ea-${id}`,
  nom,
  type: 'volaille',
  rendementCarcasse: 0.7,
  categorieReglementaire: 'volaille',
  _count: { animaux: 0, lots: 0 },
}))
const races = jeuReferentiel((id, nom) => ({
  id: `r-${id}`,
  nom,
  especeAnimaleId: especes.gleba.id,
  especeAnimale: { id: especes.gleba.id, nom: especes.gleba.nom, userId: null, partageCommunaute: false },
  _count: { animaux: 0 },
}))
/** Race partagée par un autre compte, rattachée à SON profil d'espèce privé. */
const raceSurEspecePrivee = {
  ...races.partagee,
  id: 'r-sur-espece-privee',
  especeAnimaleId: especes.privee.id,
  especeAnimale: { id: especes.privee.id, nom: especes.privee.nom, userId: AUTRE, partageCommunaute: false },
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

let especeAnimale: ReturnType<typeof delegueMemoire>
let raceAnimale: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  mocks.chargerCheptelEnStock.mockResolvedValue({ individuels: [], lots: [] })
  especeAnimale = delegueMemoire(Object.values(especes) as Ligne[])
  raceAnimale = delegueMemoire([...Object.values(races), raceSurEspecePrivee] as Ligne[])
  mocks.db.especeAnimale = especeAnimale
  mocks.db.raceAnimale = raceAnimale
  mocks.db.animal = { groupBy: vi.fn(async () => []) }
  mocks.db.avis = { deleteMany: vi.fn(async () => ({ count: 0 })) }
  mocks.db.produitVeterinaire = {
    findMany: vi.fn(async () => [
      {
        id: 'p1',
        nom: 'Produit',
        especesCibles: ['volaille'],
        tempsAttenteLaitJ: 0,
        tempsAttenteViandeJ: 7,
        tempsAttenteOeufsJ: 0,
        delaisParEspece: [],
      },
    ]),
  }
})

describe('profils d’espèce animale', () => {
  it("GET : Gleba, le sien et le partagé, sans id d'un autre compte", async () => {
    const res = await LISTE_ESPECES(requete('GET', '/api/elevage/especes-animales'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.data.map((e: Ligne) => [e.id, e.userId])).toEqual([
      ['ea-gleba-1', null],
      ['ea-cm-moi', MOI],
      ['ea-cm-partagee', 'communaute'],
    ])
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
    expect(JSON.stringify(corps)).not.toContain('secrète')
  })

  it("PUT { partageCommunaute } / DELETE sur le privé d'un autre : 404 comme un inexistant", async () => {
    const put = await PUT_ESPECE(
      requete('PUT', '/api/elevage/especes-animales/ea-cm-privee', { partageCommunaute: true }),
      params('ea-cm-privee'),
    )
    const absent = await PUT_ESPECE(
      requete('PUT', '/api/elevage/especes-animales/x', { partageCommunaute: true }),
      params('x'),
    )
    const del = await DELETE_ESPECE(requete('DELETE', '/api/elevage/especes-animales/ea-cm-privee'), params('ea-cm-privee'))
    expect([put.status, absent.status, del.status]).toEqual([404, 404, 404])
    expect(especeAnimale.update).not.toHaveBeenCalled()
    expect(especeAnimale.delete).not.toHaveBeenCalled()
  })

  it('PUT sur le sien : accepté ; sur le partagé d’un autre : 403', async () => {
    const mien = await PUT_ESPECE(
      requete('PUT', '/api/elevage/especes-animales/ea-cm-moi', { partageCommunaute: true }),
      params('ea-cm-moi'),
    )
    expect(mien.status).toBe(200)
    expect((await mien.json()).data.userId).toBe(MOI)
    const partage = await PUT_ESPECE(
      requete('PUT', '/api/elevage/especes-animales/ea-cm-partagee', { partageCommunaute: false }),
      params('ea-cm-partagee'),
    )
    expect(partage.status).toBe(403)
  })
})

describe('races', () => {
  it("GET : ni la race privée d'un autre, ni la race posée sur son espèce privée, ni son id", async () => {
    const res = await LISTE_RACES(requete('GET', '/api/elevage/races'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.data.map((r: Ligne) => [r.id, r.userId])).toEqual([
      ['r-gleba-1', null],
      ['r-cm-moi', MOI],
      ['r-cm-partagee', 'communaute'],
    ])
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
    expect(JSON.stringify(corps)).not.toContain('secrète')
  })

  it("PUT, DELETE et DELETE ?id= sur la race privée d'un autre : 404, rien d'écrit", async () => {
    const put = await PUT_RACE(requete('PUT', '/api/elevage/races/r-cm-privee', { partageCommunaute: true }), params('r-cm-privee'))
    const del = await DELETE_RACE(requete('DELETE', '/api/elevage/races/r-cm-privee'), params('r-cm-privee'))
    const delQuery = await DELETE_RACE_QUERY(requete('DELETE', '/api/elevage/races?id=r-cm-privee'))
    expect([put.status, del.status, delQuery.status]).toEqual([404, 404, 404])
    expect(raceAnimale.update).not.toHaveBeenCalled()
    expect(raceAnimale.delete).not.toHaveBeenCalled()
  })

  it('PUT sur la sienne : 200 ; DELETE ?id= sur la partagée d’un autre : 403', async () => {
    const mienne = await PUT_RACE(requete('PUT', '/api/elevage/races/r-cm-moi', { partageCommunaute: true }), params('r-cm-moi'))
    expect(mienne.status).toBe(200)
    const partagee = await DELETE_RACE_QUERY(requete('DELETE', '/api/elevage/races?id=r-cm-partagee'))
    expect(partagee.status).toBe(403)
  })
})

describe('produits vétérinaires — délais pour une espèce', () => {
  it("un profil privé d'un autre compte répond comme un id inconnu (meta.especeId null)", async () => {
    const prive = await PRODUITS(requete('GET', '/api/elevage/produits-veterinaires?especeId=ea-cm-privee'))
    const inconnu = await PRODUITS(requete('GET', '/api/elevage/produits-veterinaires?especeId=inconnu'))
    const corpsPrive = await prive.json()
    expect(corpsPrive.meta.especeId).toBeNull()
    expect(corpsPrive).toEqual(await inconnu.json())
  })

  it('le profil du compte et celui du catalogue restent résolus', async () => {
    for (const id of ['ea-cm-moi', 'ea-gleba-1']) {
      const res = await PRODUITS(requete('GET', `/api/elevage/produits-veterinaires?especeId=${id}`))
      expect((await res.json()).meta.especeId).toBe(id)
    }
  })
})
