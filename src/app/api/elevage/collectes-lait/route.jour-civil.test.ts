/**
 * ELEV-01 (revue Codex du 2026-11-12) : une traite par jour et par cible,
 * quelle que soit l'heure portée par la date.
 *
 * Le POST ramenait la date à minuit UTC, le PATCH écrivait l'horodatage tel
 * quel : une collecte redatée « 2026-11-01T12:00:00Z » échappait ensuite à la
 * recherche du POST (égalité stricte à minuit), qui créait un doublon. L'index
 * unique ne protège pas (date exacte, et `lot_id` NULL distinct en PostgreSQL).
 *
 * Route réelle sur une fausse table `collectes_lait` qui applique les filtres
 * de date (égalité, gte/lt) comme PostgreSQL.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown> & { id: string; date: Date }
const etat = vi.hoisted(() => ({ table: [] as Array<Record<string, unknown> & { id: string; date: Date }>, seq: 0 }))

function correspond(l: Ligne, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([cle, attendu]) => {
    const v = l[cle]
    if (attendu instanceof Date) return v instanceof Date && v.getTime() === attendu.getTime()
    if (attendu && typeof attendu === 'object') {
      const f = attendu as { gte?: Date; lt?: Date; lte?: Date; not?: unknown }
      if ('not' in f) return v !== f.not
      if (!(v instanceof Date)) return false
      if (f.gte && v < f.gte) return false
      if (f.lt && v >= f.lt) return false
      if (f.lte && v > f.lte) return false
      return true
    }
    return (v ?? null) === (attendu ?? null)
  })
}

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'u1' } } }),
}))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: vi.fn() }))
vi.mock('@/lib/elevage/attente-lait', () => ({
  soinCouvrantCollecte: vi.fn().mockResolvedValue(null),
  causesAttenteCollectes: vi.fn(),
}))
vi.mock('@/lib/prisma', () => {
  const db = {
    animal: {
      findFirst: async () => ({
        id: 501, sexe: 'femelle', orientationProduction: 'lait',
        especeAnimale: { nom: 'Chèvre', production: 'lait', productions: ['lait'] },
      }),
    },
    collecteLait: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const l = etat.table.find((x) => correspond(x, where))
        return l ? { ...l } : null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const l = { ...data, id: `c${++etat.seq}` } as Ligne
        etat.table.push(l)
        return { ...l }
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const l = etat.table.find((x) => x.id === where.id)!
        for (const [k, v] of Object.entries(data)) if (v !== undefined) (l as Record<string, unknown>)[k] = v
        return { ...l }
      },
    },
  }
  return { default: { ...db, $transaction: (fn: (tx: unknown) => unknown) => fn({ ...db, $executeRaw: async () => 0 }) } }
})

import { PATCH, POST } from './route'

const requete = (methode: 'POST' | 'PATCH', corps: object) =>
  new NextRequest('http://local.test/api/elevage/collectes-lait', {
    method: methode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  })

const saisir = (date: string, quantiteLitres: number) =>
  POST(requete('POST', { date, traite: 'Matin', animalId: 501, lotId: null, quantiteLitres }))

beforeEach(() => {
  etat.table.length = 0
  etat.seq = 0
})

describe('ELEV-01 : une traite par jour civil', () => {
  it('le PATCH ramène la date au jour, et la saisie suivante du même jour complète la collecte', async () => {
    expect((await saisir('2026-10-31', 2)).status).toBe(201)

    const res = await PATCH(requete('PATCH', { id: 'c1', date: '2026-11-01T12:00:00Z' }))
    expect(res.status).toBe(200)
    expect(etat.table[0].date.toISOString()).toBe('2026-11-01T00:00:00.000Z')

    const seconde = await saisir('2026-11-01', 3)
    expect(seconde.status).toBe(200)
    expect(etat.table).toHaveLength(1)
    expect(etat.table[0].quantiteLitres).toBe(3)
  })

  it('une collecte déjà horodatée en cours de journée (donnée existante) est retrouvée par la saisie du jour', async () => {
    etat.table.push({
      id: 'ancienne', userId: 'u1', date: new Date('2026-11-01T12:00:00Z'), traite: 'Matin',
      animalId: 501, lotId: null, quantiteLitres: 2, lotFromageId: null, ecarteAttente: false,
    })
    etat.seq = 1

    const res = await saisir('2026-11-01', 3)

    expect(res.status).toBe(200)
    expect(etat.table).toHaveLength(1)
    expect(etat.table[0]).toMatchObject({ id: 'ancienne', quantiteLitres: 3 })
  })

  it('redater sur un jour qui porte déjà la traite, même horodatée, est refusé', async () => {
    etat.table.push({
      id: 'midi', userId: 'u1', date: new Date('2026-11-01T12:00:00Z'), traite: 'Matin',
      animalId: 501, lotId: null, quantiteLitres: 2, lotFromageId: null, ecarteAttente: false,
    })
    etat.seq = 1
    expect((await saisir('2026-10-31', 2)).status).toBe(201)

    const res = await PATCH(requete('PATCH', { id: 'c2', date: '2026-11-01' }))

    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('COLLECTE_DEJA_SAISIE')
    expect(etat.table.find((l) => l.id === 'c2')!.date.toISOString()).toBe('2026-10-31T00:00:00.000Z')
  })
})
