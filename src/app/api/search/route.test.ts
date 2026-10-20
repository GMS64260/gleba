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
 * Revue 2026-10-20 — la recherche globale (Cmd+K) listait les variétés sans
 * règle de visibilité : la variété privée d'un autre compte sortait par son nom.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET } from './route'

const especeGleba = { id: 'Tomate', userId: null, partageCommunaute: false }
const especePrivee = { id: 'cm-esp-privee', userId: AUTRE, partageCommunaute: false }
const varietes = jeuReferentiel((id, nom) => ({
  id: `v-${id}`,
  nom: `Coeur ${nom}`,
  nomNormalise: `coeur ${nom.toLowerCase()}`,
  especeId: 'Tomate',
  espece: especeGleba,
}))
/** Variété du catalogue posée sur l'espèce privée d'un autre compte. */
const surEspecePrivee = { ...varietes.gleba, id: 'v-sur-espece-privee', nom: 'Coeur caché', espece: especePrivee }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  const vide = { findMany: vi.fn(async () => []) }
  for (const modele of ['culture', 'arbre', 'animal', 'lotAnimaux', 'client', 'facture', 'parcelleGeo', 'soinAnimal', 'recolte', 'produitBoutique']) {
    mocks.db[modele] = vide
  }
  mocks.db.variete = delegueMemoire([...Object.values(varietes), surEspecePrivee] as Ligne[])
})

describe('GET /api/search?q=', () => {
  it("ne propose que les variétés visibles du compte", async () => {
    const res = await GET(new NextRequest('http://localhost/api/search?q=coeur'))
    expect(res.status).toBe(200)
    const { items } = await res.json()
    const ids = items.filter((i: { id: string }) => i.id.startsWith('variete-')).map((i: { id: string }) => i.id)
    expect(ids).toEqual(['variete-v-gleba-1', 'variete-v-cm-moi', 'variete-v-cm-partagee'])
    expect(JSON.stringify(items)).not.toContain('secrète')
    expect(JSON.stringify(items)).not.toContain('caché')
  })
})
