import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MOI,
  delegueMemoire,
  jeuReferentiel,
  sessionDe,
  type Ligne,
} from '@/lib/__tests__/fixtures/referentiel-memoire'

/**
 * Revue 2026-10-20 — signaler l'entrée privée d'un autre compte répondait
 * 400 « pas partagée » au lieu du 404 d'une entrée inexistante : la réponse
 * confirmait son existence.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { POST } from './route'

const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom }))

/** Corps envoyé par SignalerButton. */
const signaler = (refId: string) =>
  POST(
    new NextRequest('http://localhost/api/signalements', {
      method: 'POST',
      body: JSON.stringify({ refType: 'VARIETE', refId, motif: 'Doublon manifeste' }),
      headers: { 'content-type': 'application/json' },
    }),
  )

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  mocks.db.variete = delegueMemoire(Object.values(varietes) as Ligne[])
  mocks.db.signalement = {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async () => ({ id: 'sig-1' })),
  }
})

describe('POST /api/signalements', () => {
  it("l'entrée privée d'un autre compte répond 404 comme une entrée inexistante", async () => {
    const privee = await signaler('v-cm-privee')
    const absente = await signaler('inexistante')
    expect([privee.status, absente.status]).toEqual([404, 404])
    expect(await privee.json()).toEqual(await absente.json())
  })

  it("l'entrée partagée d'un autre compte reste signalable", async () => {
    const res = await signaler('v-cm-partagee')
    expect(res.status).toBe(201)
  })

  it('le catalogue Gleba et sa propre entrée restent refusés en 400', async () => {
    expect((await signaler('v-gleba-1')).status).toBe(400)
    expect((await signaler('v-cm-moi')).status).toBe(400)
  })
})
