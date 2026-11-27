/**
 * Rattachement des planches à une rotation (équipe debug, D158).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Planche = { id: string; nom: string; ilot: null; userId: string; rotationId: string | null }
const base = vi.hoisted(() => ({ planches: [] as Planche[] }))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'moi' } } }),
}))
vi.mock('@/lib/prisma', () => {
  type Where = { userId?: string; rotationId?: string; id?: string | { in: string[] } }
  const correspond = (p: Planche, w: Where) =>
    (w.userId === undefined || p.userId === w.userId)
    && (w.rotationId === undefined || p.rotationId === w.rotationId)
    && (w.id === undefined || (typeof w.id === 'string' ? p.id === w.id : w.id.in.includes(p.id)))
  return {
    default: {
      rotation: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'rot' ? { id: 'rot' } : null) },
      planche: {
        // Les écritures sont appliquées à l'appel : la transaction reçoit des promesses déjà jouées, dans l'ordre.
        updateMany: ({ where, data }: { where: Where; data: Partial<Planche> }) => {
          for (const p of base.planches) if (correspond(p, where)) Object.assign(p, data)
          return Promise.resolve({ count: 0 })
        },
        findMany: async ({ where }: { where: Where }) => base.planches.filter((p) => correspond(p, where)),
      },
      $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
    },
  }
})

import { PUT } from './route'

const enregistrer = async (corps: unknown, rotation = 'rot') => {
  const reponse = await PUT(
    new NextRequest(`http://localhost/api/rotations/${rotation}/planches`, { method: 'PUT', body: JSON.stringify(corps) }),
    { params: Promise.resolve({ id: rotation }) },
  )
  return { statut: reponse.status, corps: await reponse.json() }
}
const rattachees = () => base.planches.filter((p) => p.rotationId === 'rot').map((p) => p.id).sort()

beforeEach(() => {
  base.planches = [
    { id: 'A', nom: 'A', ilot: null, userId: 'moi', rotationId: null },
    { id: 'B', nom: 'B', ilot: null, userId: 'moi', rotationId: null },
    { id: 'C', nom: 'C', ilot: null, userId: 'moi', rotationId: 'autre' },
    { id: 'Z', nom: 'Z', ilot: null, userId: 'tiers', rotationId: null },
  ]
})

describe('PUT /api/rotations/[id]/planches', () => {
  it('deux onglets qui cochent chacun une planche les rattachent toutes les deux', async () => {
    await enregistrer({ ajouts: ['A'], retraits: [] })
    const second = await enregistrer({ ajouts: ['B'], retraits: [] })

    expect(rattachees()).toEqual(['A', 'B'])
    expect(second.corps.count).toBe(2)
  })

  it('un retrait ne détache que de cette rotation', async () => {
    await enregistrer({ ajouts: ['A'], retraits: [] })
    await enregistrer({ ajouts: [], retraits: ['A', 'C'] })

    expect(rattachees()).toEqual([])
    expect(base.planches.find((p) => p.id === 'C')?.rotationId).toBe('autre')
  })

  it('ne rattache jamais la planche d’un autre compte', async () => {
    await enregistrer({ ajouts: ['Z'], retraits: [] })

    expect(base.planches.find((p) => p.id === 'Z')?.rotationId).toBeNull()
  })

  it('garde le remplacement intégral pour un appelant qui envoie plancheIds', async () => {
    await enregistrer({ plancheIds: ['A'] })
    await enregistrer({ plancheIds: ['B'] })

    expect(rattachees()).toEqual(['B'])
  })

  it('répond 404 pour une rotation inconnue', async () => {
    expect((await enregistrer({ ajouts: ['A'] }, 'inconnue')).statut).toBe(404)
  })
})
