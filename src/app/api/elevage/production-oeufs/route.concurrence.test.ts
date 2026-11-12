/**
 * ELEV-02 (revue Codex du 2026-11-12) : deux corrections concurrentes d'une
 * collecte d'œufs entamée ne doivent pas faire descendre le net sous les œufs
 * déjà sortis.
 *
 * Le PATCH lisait la collecte avant le verrou du stock, puis validait sous le
 * verrou la fusion de ses champs avec cette lecture périmée. Collecte 100,
 * cassés 0, 90 vendus : {quantite: 90} et {casses: 10} validaient chacun un
 * net de 90, et la base finissait à 90 − 10 = 80 pour 90 vendus.
 *
 * Route réelle ; fausse base en mémoire dont le verrou consultatif sérialise
 * les transactions comme `pg_advisory_xact_lock`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const etat = vi.hoisted(() => ({
  ligne: null as null | Record<string, unknown>,
  sorties: [] as Array<{ quantite: number; date: Date }>,
  verrou: Promise.resolve() as Promise<void>,
  aLaPriseDuVerrou: null as null | (() => void),
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'u1' } } }),
}))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const productionOeuf = {
    findFirst: async ({ where }: { where: { id: number; userId: string } }) =>
      etat.ligne && etat.ligne.id === where.id && etat.ligne.userId === where.userId ? { ...etat.ligne } : null,
    update: async ({ data }: { data: Record<string, unknown> }) => {
      // Prisma n'écrit que les champs transmis.
      for (const [k, v] of Object.entries(data)) if (v !== undefined) etat.ligne![k] = v
      return { ...etat.ligne }
    },
  }
  const db = {
    productionOeuf,
    lotAnimaux: { findFirst: vi.fn() },
    animal: { findFirst: vi.fn() },
  }
  return {
    default: {
      ...db,
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        let liberer!: () => void
        const tx = {
          ...db,
          mouvementStockOeuf: { findMany: async () => etat.sorties.map((s) => ({ ...s })) },
          $executeRaw: async () => {
            const precedent = etat.verrou
            etat.verrou = new Promise<void>((r) => { liberer = r })
            await precedent
            etat.aLaPriseDuVerrou?.()
            return 0
          },
        }
        try {
          return await fn(tx)
        } finally {
          liberer?.()
        }
      },
    },
  }
})

import { PATCH } from './route'

const corriger = (corps: object) =>
  PATCH(new NextRequest('http://local.test/api/elevage/production-oeufs', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 7, ...corps }),
  }))

beforeEach(() => {
  etat.verrou = Promise.resolve()
  etat.aLaPriseDuVerrou = null
  etat.ligne = {
    id: 7, userId: 'u1', date: new Date('2026-11-01T00:00:00Z'), quantite: 100, casses: 0, sales: 0,
    lotId: null, animalId: null, calibre: null, notes: null,
  }
  etat.sorties = [{ quantite: 90, date: new Date('2026-11-02T00:00:00Z') }]
})

describe('ELEV-02 : correction d’une collecte entamée sous verrou', () => {
  it('deux corrections concurrentes ne font pas descendre le net sous les œufs sortis', async () => {
    const [a, b] = await Promise.all([corriger({ quantite: 90 }), corriger({ casses: 10 })])

    const statuts = [a.status, b.status].sort()
    expect(statuts).toEqual([200, 409])
    const net = (etat.ligne!.quantite as number) - (etat.ligne!.casses as number) - (etat.ligne!.sales as number)
    expect(net).toBeGreaterThanOrEqual(90)
  })

  it('une correction seule compatible avec les sorties passe', async () => {
    const res = await corriger({ casses: 10 })
    expect(res.status).toBe(200)
    expect(etat.ligne).toMatchObject({ quantite: 100, casses: 10 })
  })

  it('une collecte supprimée entre la lecture et le verrou répond 404', async () => {
    etat.aLaPriseDuVerrou = () => { etat.ligne = null }
    const res = await corriger({ casses: 5 })
    expect(res.status).toBe(404)
  })
})
