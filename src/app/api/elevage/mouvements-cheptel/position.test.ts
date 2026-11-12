/**
 * Position courante d'un animal ou d'un lot (revue Codex ELEV-05, 2026-11-12).
 *
 * Toute écriture de `parcelleGeoId` journalise un mouvement : le journal fait
 * foi. La position est celle du dernier mouvement par date ; sans mouvement
 * restant, c'est la parcelle d'origine du mouvement supprimé.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Mouvement = {
  id: string; userId: string; animalId: number | null; lotId: number | null
  parcelleAvantId: string | null; parcelleApresId: string | null; date: Date; createdAt: Date
}

const etat = vi.hoisted(() => ({
  mouvements: [] as Mouvement[],
  positionAnimal: null as string | null,
  positionLot: null as string | null,
  horloge: 0,
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'user-1' } } }),
}))
vi.mock('@/lib/prisma', () => {
  const correspond = (m: Mouvement, where: Record<string, unknown>) =>
    Object.entries(where).every(([cle, valeur]) => (m as Record<string, unknown>)[cle] === valeur)
  const db = {
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
    animal: {
      findFirst: async () => ({ id: 7 }),
      updateMany: async ({ data }: { data: { parcelleGeoId: string | null } }) => { etat.positionAnimal = data.parcelleGeoId; return { count: 1 } },
    },
    lotAnimaux: {
      findFirst: async () => ({ id: 12 }),
      updateMany: async ({ data }: { data: { parcelleGeoId: string | null } }) => { etat.positionLot = data.parcelleGeoId; return { count: 1 } },
    },
    parcelleGeo: { findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id }) },
    mouvementCheptel: {
      create: async ({ data }: { data: Omit<Mouvement, 'id' | 'createdAt'> }) => {
        const m = { ...data, id: `m${etat.mouvements.length + 1}`, createdAt: new Date(++etat.horloge) }
        etat.mouvements.push(m)
        return m
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = etat.mouvements.findIndex((m) => m.id === where.id)
        return etat.mouvements.splice(i, 1)[0]
      },
      findFirst: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: unknown }) => {
        const trouves = etat.mouvements.filter((m) => correspond(m, where))
        if (orderBy) trouves.sort((a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
        return trouves[0] ?? null
      },
    },
  }
  return { default: { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) } }
})

import { DELETE, POST } from './route'

const poster = (body: object) => POST(new NextRequest('http://localhost/api/elevage/mouvements-cheptel', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
}))
const supprimer = (id: string) => DELETE(new NextRequest(`http://localhost/api/elevage/mouvements-cheptel?id=${id}`, { method: 'DELETE' }))

beforeEach(() => {
  etat.mouvements = []
  etat.positionAnimal = null
  etat.positionLot = null
  etat.horloge = 0
})

describe('mouvements de cheptel et position courante', () => {
  it('supprimer le seul mouvement A→B ramène l’animal en A', async () => {
    await poster({ animalId: 7, parcelleAvantId: 'A', parcelleApresId: 'B', date: '2026-11-01T10:00:00Z' })
    expect(etat.positionAnimal).toBe('B')
    const res = await supprimer('m1')
    expect(res.status).toBe(200)
    expect(etat.positionAnimal).toBe('A')
  })

  it('supprimer le seul mouvement d’un lot le ramène aussi à son origine', async () => {
    await poster({ lotId: 12, parcelleAvantId: 'A', parcelleApresId: 'B', date: '2026-11-01T10:00:00Z' })
    await supprimer('m1')
    expect(etat.positionLot).toBe('A')
  })

  it('un mouvement antidaté ne remplace pas la position du mouvement le plus récent', async () => {
    await poster({ animalId: 7, parcelleAvantId: 'A', parcelleApresId: 'B', date: '2026-11-01T10:00:00Z' })
    const res = await poster({ animalId: 7, parcelleAvantId: 'C', parcelleApresId: 'A', date: '2026-10-01T10:00:00Z' })
    expect(res.status).toBe(201)
    expect(etat.positionAnimal).toBe('B')
  })

  it('un mouvement plus récent devient la position courante', async () => {
    await poster({ animalId: 7, parcelleAvantId: 'A', parcelleApresId: 'B', date: '2026-11-01T10:00:00Z' })
    await poster({ animalId: 7, parcelleAvantId: 'B', parcelleApresId: 'C', date: '2026-11-05T10:00:00Z' })
    expect(etat.positionAnimal).toBe('C')
  })

  it('supprimer le dernier mouvement revient à la destination du précédent', async () => {
    await poster({ animalId: 7, parcelleAvantId: 'A', parcelleApresId: 'B', date: '2026-11-01T10:00:00Z' })
    await poster({ animalId: 7, parcelleAvantId: 'B', parcelleApresId: 'C', date: '2026-11-05T10:00:00Z' })
    await supprimer('m2')
    expect(etat.positionAnimal).toBe('B')
  })
})
