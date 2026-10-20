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
 * Revue 2026-10-20 — isolation des référentiels du verger entre comptes
 * (porte-greffes, essences bocagères et forestières, export CSV, détection
 * des triploïdes). L'entrée privée d'un autre compte ne sort pas, ne se
 * modifie ni ne se supprime (404 comme une inexistante), aucun id tiers.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/avis/stats-liste', () => ({ statsAvisPourRefs: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET as LISTE_PG } from './porte-greffes/route'
import { DELETE as DELETE_PG, PUT as PUT_PG } from './porte-greffes/[id]/route'
import { GET as LISTE_BOCAGE } from './essences-bocageres/route'
import { DELETE as DELETE_BOCAGE, PUT as PUT_BOCAGE } from './essences-bocageres/[id]/route'
import { GET as LISTE_FORET } from './essences-forestieres/route'
import { DELETE as DELETE_FORET, PUT as PUT_FORET } from './essences-forestieres/[id]/route'
import { GET as EXPORT } from './referentiel/export/route'
import { GET as TRIPLOIDES } from './triploides/route'

const espece = { id: 'Pommier', nom: 'Pommier', userId: null, partageCommunaute: false }
const porteGreffes = jeuReferentiel((id, nom) => ({
  id: `pg-${id}`,
  nom,
  vigueur: 3,
  precocite: 3,
  sensibilites: [],
  drageonnement: false,
  notes: `Notes ${nom}`,
  especes: [{ especeId: 'Pommier', espece }],
}))
const bocageres = jeuReferentiel((id, nom) => ({
  id: `eb-${id}`,
  nomCommun: nom,
  nomLatin: 'Latin',
  hauteurM: 3,
  croissance: 'Moyenne',
  roles: ['mellifère'],
  persistant: false,
  epineux: false,
  notes: null,
}))
const forestieres = jeuReferentiel((id, nom) => ({ id: `ef-${id}`, nom, nomLatin: 'Latin' }))
const especesVerger = jeuReferentiel((id, nom) => ({ id: `e-${id}`, nom, type: 'arbre_fruitier', nomLatin: `Latin ${nom}` }))

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

const delegues: Record<string, ReturnType<typeof delegueMemoire>> = {}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  delegues.porteGreffe = delegueMemoire(Object.values(porteGreffes) as Ligne[])
  delegues.essenceBocagere = delegueMemoire(Object.values(bocageres) as Ligne[])
  delegues.essenceForestiere = delegueMemoire(Object.values(forestieres) as Ligne[])
  delegues.espece = delegueMemoire(Object.values(especesVerger) as Ligne[])
  Object.assign(mocks.db, delegues)
})

describe.each([
  ['porte-greffes', LISTE_PG, 'pg-'],
  ['essences-bocageres', LISTE_BOCAGE, 'eb-'],
  ['essences-forestieres', LISTE_FORET, 'ef-'],
] as const)('GET /api/verger/%s', (chemin, lister, prefixe) => {
  it("sert Gleba, la sienne et la partagée, sans la privée d'un autre ni son id", async () => {
    const res = await lister(requete('GET', `/api/verger/${chemin}`))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.data.map((e: Ligne) => [e.id, e.userId])).toEqual([
      [`${prefixe}gleba-1`, null],
      [`${prefixe}cm-moi`, MOI],
      [`${prefixe}cm-partagee`, 'communaute'],
    ])
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
    expect(JSON.stringify(corps)).not.toContain('secrète')
  })
})

describe.each([
  ['porte-greffes', PUT_PG, DELETE_PG, 'porteGreffe', 'pg-'],
  ['essences-bocageres', PUT_BOCAGE, DELETE_BOCAGE, 'essenceBocagere', 'eb-'],
  ['essences-forestieres', PUT_FORET, DELETE_FORET, 'essenceForestiere', 'ef-'],
] as const)('PUT / DELETE /api/verger/%s/[id] — corps envoyés par OrigineControls', (chemin, put, del, modele, prefixe) => {
  it("sur la privée d'un autre : 404 comme une inexistante, rien d'écrit", async () => {
    const id = `${prefixe}cm-privee`
    const statuts = [
      (await put(requete('PUT', `/api/verger/${chemin}/${id}`, { partageCommunaute: true }), params(id))).status,
      (await put(requete('PUT', `/api/verger/${chemin}/x`, { partageCommunaute: true }), params('x'))).status,
      (await del(requete('DELETE', `/api/verger/${chemin}/${id}`), params(id))).status,
    ]
    expect(statuts).toEqual([404, 404, 404])
    expect(delegues[modele].update).not.toHaveBeenCalled()
    expect(delegues[modele].delete).not.toHaveBeenCalled()
  })

  it('sur la sienne : 200 ; sur la partagée d’un autre : 403', async () => {
    const mien = await put(
      requete('PUT', `/api/verger/${chemin}/${prefixe}cm-moi`, { partageCommunaute: true }),
      params(`${prefixe}cm-moi`),
    )
    expect(mien.status).toBe(200)
    expect((await mien.json()).userId).toBe(MOI)
    const partage = await del(requete('DELETE', `/api/verger/${chemin}/${prefixe}cm-partagee`), params(`${prefixe}cm-partagee`))
    expect(partage.status).toBe(403)
  })
})

describe('GET /api/verger/referentiel/export', () => {
  it.each(['especes', 'porte-greffes', 'essences'])(
    "le CSV « %s » ne contient pas l'entrée privée d'un autre compte",
    async (onglet) => {
      const res = await EXPORT(requete('GET', `/api/verger/referentiel/export?onglet=${onglet}`))
      expect(res.status).toBe(200)
      const csv = await res.text()
      expect(csv).not.toContain('secrète')
      expect(csv).not.toContain('cm-privee')
      // Le catalogue, l'entrée du compte et la partagée sortent toujours.
      for (const marque of onglet === 'especes' ? ['e-gleba-1', 'e-cm-moi', 'e-cm-partagee'] : ['Entrée Gleba', 'Entrée du compte', 'Entrée partagée']) {
        expect(csv).toContain(marque)
      }
    },
  )
})

describe('GET /api/verger/triploides', () => {
  const arbre = { id: 1, nom: 'Arbre 1', espece: 'Pommier', especeId: 'Pommier', variete: 'Reinette du test', gpsLat: null, gpsLng: null, zoneId: null }
  const variete = (userId: string | null, partageCommunaute: boolean) => ({
    id: `v-${userId ?? 'gleba'}`,
    nom: 'Reinette du test',
    nomNormalise: 'reinette du test',
    especeId: 'Pommier',
    userId,
    partageCommunaute,
    ploidie: 'Triploïde',
    groupePollinisation: 'C',
  })

  it("la ploïdie d'une variété privée d'un autre compte homonyme ne compte pas", async () => {
    mocks.db.arbre = { findMany: vi.fn(async () => [arbre]) }
    mocks.db.variete = delegueMemoire([variete(AUTRE, false)])
    const res = await TRIPLOIDES(requete('GET', '/api/verger/triploides'))
    expect((await res.json()).alertes).toEqual([])
  })

  it('la variété du compte, elle, déclenche l’alerte', async () => {
    mocks.db.arbre = { findMany: vi.fn(async () => [arbre]) }
    mocks.db.variete = delegueMemoire([variete(AUTRE, false), variete(MOI, false)])
    const res = await TRIPLOIDES(requete('GET', '/api/verger/triploides'))
    const { alertes } = await res.json()
    expect(alertes.map((a: { arbre: { id: number } }) => a.arbre.id)).toEqual([1])
  })
})
