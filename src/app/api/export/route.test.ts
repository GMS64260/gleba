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
 * Revue 2026-10-20 — l'export JSON du compte emporte les référentiels qu'il
 * voit ; l'auteur d'une entrée partagée par un autre compte y figurait par
 * son id. Il sort désormais sous le marqueur « communaute ».
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET } from './route'

const lignes = (prefixe: string) =>
  Object.values(jeuReferentiel((id, nom) => ({ id: `${prefixe}-${id}`, nom }))) as Ligne[]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  const vide = { findMany: vi.fn(async () => []) }
  for (const modele of [
    'famille', 'fournisseur', 'rotation', 'rotationDetail', 'fertilisant', 'association',
    'associationDetail', 'planche', 'culture', 'recolte', 'fertilisation', 'analyseSol',
    'objetJardin', 'arbre',
  ]) {
    mocks.db[modele] = vide
  }
  mocks.db.espece = delegueMemoire(lignes('e'))
  mocks.db.variete = delegueMemoire(lignes('v'))
  mocks.db.iTP = delegueMemoire(lignes('i'))
})

describe('GET /api/export?format=json', () => {
  it("emporte Gleba, les entrées du compte et les partagées, sans id d'un autre compte", async () => {
    const res = await GET(new NextRequest('http://localhost/api/export?format=json'))
    expect(res.status).toBe(200)
    const export_ = JSON.parse(await res.text())
    for (const cle of ['especes', 'varietes', 'itps']) {
      expect(export_[cle].map((e: Ligne) => e.userId)).toEqual([null, MOI, 'communaute'])
    }
    const brut = JSON.stringify(export_)
    expect(brut).not.toContain(AUTRE)
    expect(brut).not.toContain('secrète')
  })
})
