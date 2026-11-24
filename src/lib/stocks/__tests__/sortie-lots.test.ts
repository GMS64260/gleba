/**
 * Modèle de stock unique, lot 2 (2026-11-24) : une sortie saisie dans
 * Consommations prend les lots libres de l'espèce, du plus ancien au plus
 * récent, et scinde le dernier lot entamé. Base simulée en mémoire : la
 * sélection des lots candidats (statut, unité, document, boutique) est celle
 * que `sortirParLots` demande à Prisma, rejouée ici sur un tableau.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const caisse = vi.hoisted(() => ({ reserves: new Map<string, number>() }))
vi.mock('@/lib/caisse/reservations', () => ({ quantitesCaisse: async () => caisse.reserves }))

import { rendreLotsConsommation, sortirParLots } from '@/lib/stocks/sortie-lots'

type Lot = {
  id: number; userId: string; especeId: string; cultureId: number; date: Date; quantite: number; unite: string | null
  statut: string; stockDisponibleCommercial: number | null; enBoutique: boolean; dateSortie: Date | null
  consommationId: number | null; notes: string | null; datePeremption: Date | null; statutBioSnapshot: string | null
}
let lots: Lot[] = []
let prochainId = 100
const jour = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const lot = (id: number, iso: string, quantite: number, autre: Partial<Lot> = {}): Lot => ({
  id, userId: 'u1', especeId: 'Carotte', cultureId: 7, date: jour(iso), quantite, unite: 'kg', statut: 'en_stock',
  stockDisponibleCommercial: null, enBoutique: false, dateSortie: null, consommationId: null, notes: null,
  datePeremption: null, statutBioSnapshot: 'AB', ...autre,
})

type Where = Record<string, unknown> & { OR?: Array<{ unite: string | null }>; statut?: unknown; unite?: string }
const correspond = (l: Lot, w: Where) =>
  (w.userId === undefined || l.userId === w.userId)
  && (w.especeId === undefined || l.especeId === w.especeId)
  && (w.consommationId === undefined || l.consommationId === w.consommationId)
  && (typeof w.statut !== 'string' || l.statut === w.statut)
  && (typeof w.statut !== 'object' || (w.statut as { in: string[] }).in.includes(l.statut))
  && (!('stockDisponibleCommercial' in w) || l.stockDisponibleCommercial === null)
  && (!('produitsBoutique' in w) || !l.enBoutique)
  && (w.unite === undefined || l.unite === w.unite)
  && (!w.OR || w.OR.some((o) => o.unite === l.unite))

const tx = {
  recolte: {
    findMany: vi.fn(async ({ where }: { where: Where }) =>
      lots.filter((l) => correspond(l, where)).sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id).map((l) => ({ ...l }))),
    update: vi.fn(async ({ where, data }: { where: { id: number }; data: Partial<Lot> }) => {
      const l = lots.find((x) => x.id === where.id)!
      Object.assign(l, data)
      return l
    }),
    create: vi.fn(async ({ data }: { data: Partial<Lot> }) => {
      const l = { ...lot(prochainId++, '2000-01-01', 0), ...data } as Lot
      lots.push(l)
      return { id: l.id }
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Where; data: Partial<Lot> }) => {
      const touches = lots.filter((l) => correspond(l, where))
      touches.forEach((l) => Object.assign(l, data))
      return { count: touches.length }
    }),
  },
  $queryRaw: vi.fn(async () => []),
}

const sortir = (quantite: number, autre: Partial<Parameters<typeof sortirParLots>[2]> = {}) =>
  sortirParLots(tx as never, 'u1', {
    especeId: 'Carotte', unite: 'kg', quantite, date: jour('2026-11-20'), statut: 'don', consommationId: 42, ...autre,
  })

beforeEach(() => {
  vi.clearAllMocks()
  caisse.reserves = new Map()
  prochainId = 100
  lots = [lot(1, '2026-09-01', 2), lot(2, '2026-10-01', 5), lot(3, '2026-11-01', 4)]
})

describe('sortirParLots', () => {
  it('prend les lots du plus ancien au plus récent et scinde le dernier entamé', async () => {
    const r = await sortir(4)
    expect(r).toEqual({ couvert: 4, horsLots: 0, lots: [{ id: 1, quantite: 2, reliquatId: null }, { id: 2, quantite: 2, reliquatId: 100 }] })
    expect(lots.find((l) => l.id === 1)).toMatchObject({ statut: 'don', dateSortie: jour('2026-11-20'), consommationId: 42, quantite: 2 })
    expect(lots.find((l) => l.id === 2)).toMatchObject({ statut: 'don', consommationId: 42, quantite: 2 })
    expect(lots.find((l) => l.id === 100)).toMatchObject({
      statut: 'en_stock', quantite: 3, date: jour('2026-10-01'), cultureId: 7, unite: 'kg', statutBioSnapshot: 'AB', consommationId: null,
    })
    expect(lots.find((l) => l.id === 3)).toMatchObject({ statut: 'en_stock', quantite: 4 })
  })

  it('ne prend pas un lot récolté après le jour de la sortie : le reste est hors lots', async () => {
    const r = await sortir(10, { date: jour('2026-10-15') })
    expect(r).toMatchObject({ couvert: 7, horsLots: 3 })
    expect(lots.find((l) => l.id === 3)?.statut).toBe('en_stock')
  })

  it('écarte les lots entamés par un document, en boutique, réservés au marché ou dans une autre unité', async () => {
    lots = [
      lot(1, '2026-09-01', 2, { stockDisponibleCommercial: 1 }),
      lot(2, '2026-09-02', 2, { enBoutique: true }),
      lot(3, '2026-09-03', 2),
      lot(4, '2026-09-04', 2, { unite: 'botte' }),
      lot(5, '2026-09-05', 2, { unite: null }),
    ]
    caisse.reserves = new Map([['recolte:3:kg', 2]])
    const r = await sortir(3)
    expect(r.lots.map((l) => l.id)).toEqual([5])
    expect(r).toMatchObject({ couvert: 2, horsLots: 1 })
  })

  it('arrondit le reste d’un lot scindé au millième', async () => {
    lots = [lot(1, '2026-09-01', 0.3)]
    const r = await sortir(0.1)
    expect(r).toMatchObject({ couvert: 0.1, horsLots: 0 })
    expect(lots.find((l) => l.id === 100)?.quantite).toBe(0.2)
  })

  it('rendreLotsConsommation remet en stock les seuls lots encore sortis par cette consommation', async () => {
    await sortir(4)
    lots.push(lot(9, '2026-09-01', 1, { statut: 'vendu', consommationId: 42 }))
    const rendus = await rendreLotsConsommation(tx as never, 'u1', 42)
    expect(rendus).toBe(2)
    expect(lots.filter((l) => l.statut === 'en_stock').map((l) => [l.id, l.quantite])).toEqual([[1, 2], [2, 2], [3, 4], [100, 3]])
    expect(lots.find((l) => l.id === 1)).toMatchObject({ dateSortie: null, consommationId: null })
    expect(lots.find((l) => l.id === 9)?.statut).toBe('vendu')
  })
})
