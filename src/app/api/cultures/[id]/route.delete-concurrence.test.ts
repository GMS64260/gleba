/**
 * DELETE /api/cultures/[id] face à une vente concurrente (revue Codex MAR-05, 2026-11-12).
 *
 * Les contrôles (ventes de récolte, traitements, lots commerciaux) étaient lus
 * hors transaction, sans le verrou commun des ventes. Une vente directe de la
 * récolte, validée entre ce contrôle et la transaction, était ensuite effacée :
 * la récolte partait en cascade avec la culture, et sa recette avec elle.
 *
 * Le faux client ci-dessous joue cette vente au moment où la suppression ouvre
 * sa transaction : elle tenait le verrou commun et s'est validée la première.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Recolte = { id: number; cultureId: number; userId: string; statut: string; factureId: number | null; especeId: string; quantite: number }
type Vente = { id: number; userId: string; sourceType: string; sourceId: number; auto: boolean; montant: number }

const etat = vi.hoisted(() => ({
  culture: null as null | { id: number; userId: string; especeId: string },
  recoltes: [] as Recolte[],
  ventes: [] as Vente[],
  traitements: 0,
  venteEnAttente: null as null | (() => void),
  verrous: [] as string[],
  invalidateKpi: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'user-1' } } }),
}))
vi.mock('@/lib/irrigation-cache', () => ({ irrigationCache: { invalidateUser: vi.fn() } }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: etat.invalidateKpi }))
vi.mock('@/lib/prisma', () => {
  const db = {
    $executeRaw: async (morceaux: TemplateStringsArray, ...valeurs: unknown[]) => { etat.verrous.push(String(valeurs[0])); return 0 },
    $queryRaw: async () => [{ id: 42 }],
    mouvementStockCommercial: { count: async () => 0 },
    intervention: { count: async () => etat.traitements },
    culture: {
      findUnique: async () => etat.culture,
      findFirst: async () => etat.culture,
      delete: async () => {
        // Clé étrangère recoltes.culture en ON DELETE CASCADE.
        etat.recoltes = etat.recoltes.filter((r) => r.cultureId !== etat.culture!.id)
        const c = etat.culture
        etat.culture = null
        return c
      },
    },
    recolte: {
      findMany: async ({ where }: { where: { cultureId: number; userId: string } }) =>
        etat.recoltes.filter((r) => r.cultureId === where.cultureId && r.userId === where.userId).map((r) => ({ ...r })),
    },
    venteManuelle: {
      findMany: async ({ where }: { where: { userId: string; sourceId: { in: number[] } } }) =>
        etat.ventes.filter((v) => v.userId === where.userId && where.sourceId.in.includes(v.sourceId)).map((v) => ({ sourceId: v.sourceId })),
      deleteMany: async ({ where }: { where: { sourceId: { in: number[] }; auto?: boolean } }) => {
        const avant = etat.ventes.length
        etat.ventes = etat.ventes.filter((v) => !(where.sourceId.in.includes(v.sourceId) && (where.auto === undefined || v.auto === where.auto)))
        return { count: avant - etat.ventes.length }
      },
    },
  }
  return {
    default: {
      ...db,
      $transaction: async (callback: (tx: typeof db) => unknown) => {
        etat.venteEnAttente?.()
        etat.venteEnAttente = null
        return callback(db)
      },
    },
  }
})

import { DELETE } from './route'
import { supprimerCulture } from '@/lib/cultures/suppression'

const supprimer = () => DELETE(
  new NextRequest('http://localhost/api/cultures/42', { method: 'DELETE' }),
  { params: Promise.resolve({ id: '42' }) },
)

beforeEach(() => {
  etat.culture = { id: 42, userId: 'user-1', especeId: 'Tomate' }
  etat.recoltes = [{ id: 3, cultureId: 42, userId: 'user-1', statut: 'en_stock', factureId: null, especeId: 'Tomate', quantite: 10 }]
  etat.ventes = []
  etat.traitements = 0
  etat.verrous = []
  etat.venteEnAttente = null
  etat.invalidateKpi.mockClear()
})

describe('DELETE /api/cultures/[id] — vente concurrente', () => {
  it('refuse de supprimer une culture dont la récolte vient d’être vendue, sans rien effacer', async () => {
    etat.venteEnAttente = () => {
      etat.recoltes[0].statut = 'vendu'
      etat.ventes.push({ id: 11, userId: 'user-1', sourceType: 'recolte', sourceId: 3, auto: true, montant: 20 })
    }
    const res = await supprimer()
    expect(res.status).toBe(409)
    expect(etat.culture).not.toBeNull()
    expect(etat.recoltes).toHaveLength(1)
    expect(etat.ventes).toHaveLength(1)
  })

  it('refuse aussi un traitement phytosanitaire réalisé enregistré pendant ce temps', async () => {
    etat.venteEnAttente = () => { etat.traitements = 1 }
    const res = await supprimer()
    expect(res.status).toBe(409)
    expect(etat.culture).not.toBeNull()
  })

  it('prend le verrou commun des ventes avant de supprimer', async () => {
    const res = await supprimer()
    expect(res.status).toBe(200)
    expect(etat.culture).toBeNull()
    expect(etat.verrous).toEqual(['gleba:reglements:user-1', 'gleba:stock-commercial:user-1'])
  })
})

describe('supprimerCulture — fonction publique (route et assistant)', () => {
  it('rend un résultat typé, sans réponse HTTP', async () => {
    etat.venteEnAttente = () => { etat.recoltes[0].statut = 'vendu' }
    const refus = await supprimerCulture('user-1', 42)
    expect(refus).toMatchObject({ ok: false, status: 409, details: { recoltes: 1, recoltesVendues: 1 } })
    expect(etat.invalidateKpi).not.toHaveBeenCalled()

    etat.recoltes[0].statut = 'en_stock'
    expect(await supprimerCulture('user-1', 42, { invaliderIndicateurs: false })).toEqual({ ok: true, cultureId: 42, recoltesSupprimees: 1 })
    expect(etat.invalidateKpi).not.toHaveBeenCalled()
  })

  it('refuse un identifiant invalide et une culture d’un autre compte', async () => {
    expect(await supprimerCulture('user-1', Number.NaN)).toMatchObject({ ok: false, status: 400 })
    etat.culture = null
    expect(await supprimerCulture('user-1', 42)).toEqual({ ok: false, status: 404, error: 'Culture #42 non trouvée' })
  })
})
