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
  createdAt: Date
}
let lots: Lot[] = []
let prochainId = 100
const jour = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const lot = (id: number, iso: string, quantite: number, autre: Partial<Lot> = {}): Lot => ({
  id, userId: 'u1', especeId: 'Carotte', cultureId: 7, date: jour(iso), quantite, unite: 'kg', statut: 'en_stock',
  stockDisponibleCommercial: null, enBoutique: false, dateSortie: null, consommationId: null, notes: null,
  datePeremption: null, statutBioSnapshot: 'AB', createdAt: new Date(`${iso}T08:00:00.000Z`), ...autre,
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
  && (!w.id || !(w.id as { notIn: number[] }).notIn.includes(l.id))
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
  $executeRaw: vi.fn(async () => 1),
  // Lots en boutique (hors stock) : ceux marqués `enBoutique`.
  produitBoutique: { findMany: vi.fn(async () => lots.filter((l) => l.enBoutique).map((l) => ({ recolteId: l.id }))) },
  mouvementStockCommercial: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { mouvements.push({ id: `m${mouvements.length + 1}`, ...data }); return { id: `m${mouvements.length}` } }),
    findMany: vi.fn(async ({ where }: { where: { cleIdempotence: { startsWith: string } } }) =>
      mouvements.filter((m) => String(m.cleIdempotence).startsWith(where.cleIdempotence.startsWith))),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => { mouvements = mouvements.filter((m) => m.id !== where.id) }),
  },
}
let mouvements: Array<Record<string, unknown>> = []

const sortir = (quantite: number, autre: Partial<Parameters<typeof sortirParLots>[2]> = {}) =>
  sortirParLots(tx as never, 'u1', {
    especeId: 'Carotte', unite: 'kg', quantite, date: jour('2026-11-20'), statut: 'don', consommationId: 42, ...autre,
  })

beforeEach(() => {
  vi.clearAllMocks()
  mouvements = []
  caisse.reserves = new Map()
  prochainId = 100
  lots = [lot(1, '2026-09-01', 2), lot(2, '2026-10-01', 5), lot(3, '2026-11-01', 4)]
})

describe('sortirParLots', () => {
  it('prend les lots du plus ancien au plus récent ; le lot entamé garde son identité et le reste', async () => {
    const r = await sortir(4)
    expect(r).toEqual({ couvert: 4, horsLots: 0, lots: [{ id: 1, quantite: 2, reliquatId: null }, { id: 100, quantite: 2, reliquatId: 2 }] })
    expect(lots.find((l) => l.id === 1)).toMatchObject({ statut: 'don', dateSortie: jour('2026-11-20'), consommationId: 42, quantite: 2 })
    // Le lot 2 reste en stock avec 3 kg ; la part sortie est une nouvelle ligne.
    expect(lots.find((l) => l.id === 2)).toMatchObject({ statut: 'en_stock', quantite: 3, consommationId: null })
    expect(lots.find((l) => l.id === 100)).toMatchObject({
      statut: 'don', quantite: 2, date: jour('2026-10-01'), cultureId: 7, unite: 'kg', statutBioSnapshot: 'AB', consommationId: 42,
      // Même instant de saisie que le lot d'origine : une part de lot compté reste comptée.
      createdAt: new Date('2026-10-01T08:00:00.000Z'),
    })
    expect(lots.find((l) => l.id === 3)).toMatchObject({ statut: 'en_stock', quantite: 4 })
  })

  it('écart d’inventaire : les plus récents d’abord', async () => {
    const r = await sortir(5, { ordre: 'recents', statut: 'ecart', consommationId: null })
    expect(r.lots).toEqual([{ id: 3, quantite: 4, reliquatId: null }, { id: 100, quantite: 1, reliquatId: 2 }])
    expect(lots.find((l) => l.id === 2)).toMatchObject({ statut: 'en_stock', quantite: 4 })
  })

  it('d’un lot réservé au marché, seule la part non réservée sort ; le lot garde sa réservation', async () => {
    lots = [lot(1, '2026-09-01', 10)]
    caisse.reserves = new Map([['recolte:1:kg', 8]])
    const r = await sortir(5)
    expect(r).toMatchObject({ couvert: 2, horsLots: 3 })
    expect(lots.find((l) => l.id === 1)).toMatchObject({ statut: 'en_stock', quantite: 8 })
    expect(lots.find((l) => l.id === 100)).toMatchObject({ statut: 'don', quantite: 2 })
  })

  it('ne prend pas un lot récolté après le jour de la sortie : le reste est hors lots', async () => {
    const r = await sortir(10, { date: jour('2026-10-15') })
    expect(r).toMatchObject({ couvert: 7, horsLots: 3 })
    expect(lots.find((l) => l.id === 3)?.statut).toBe('en_stock')
  })

  it('écarte les lots en boutique, réservés au marché ou dans une autre unité ; un lot lié sort par le journal', async () => {
    lots = [
      lot(1, '2026-09-01', 2, { stockDisponibleCommercial: 1 }),
      lot(2, '2026-09-02', 2, { enBoutique: true }),
      lot(3, '2026-09-03', 2),
      lot(4, '2026-09-04', 2, { unite: 'botte' }),
      lot(5, '2026-09-05', 2, { unite: null }),
    ]
    // Lot 3 réservé en entier au marché : rien n'en sort.
    caisse.reserves = new Map([['recolte:3:kg', 2]])
    const r = await sortir(4)
    expect(r.lots.map((l) => l.id)).toEqual([1, 5])
    expect(r).toMatchObject({ couvert: 3, horsLots: 1 })
    // Le lot 1, lié à un bon, garde son statut ; son reste passe à 0 par un mouvement.
    expect(lots.find((l) => l.id === 1)).toMatchObject({ statut: 'en_stock', stockDisponibleCommercial: 0 })
    expect(mouvements).toEqual([expect.objectContaining({
      nature: 'don', recolteId: 1, articleStockType: 'recolte', quantite: 1, unite: 'kg', cleIdempotence: 'consommation:42:lot:1',
    })])
  })

  it('arrondit le reste d’un lot scindé au millième', async () => {
    lots = [lot(1, '2026-09-01', 0.3)]
    const r = await sortir(0.1)
    expect(r).toMatchObject({ couvert: 0.1, horsLots: 0 })
    expect(lots.find((l) => l.id === 1)?.quantite).toBe(0.2)
    expect(lots.find((l) => l.id === 100)?.quantite).toBe(0.1)
  })

  it('rendreLotsConsommation remet en stock les seuls lots encore sortis par cette consommation', async () => {
    await sortir(4)
    lots.push(lot(9, '2026-09-01', 1, { statut: 'vendu', consommationId: 42 }))
    const rendus = await rendreLotsConsommation(tx as never, 'u1', 42)
    expect(rendus).toBe(2)
    expect(lots.filter((l) => l.statut === 'en_stock').map((l) => [l.id, l.quantite])).toEqual([[1, 2], [2, 3], [3, 4], [100, 2]])
    expect(lots.find((l) => l.id === 1)).toMatchObject({ dateSortie: null, consommationId: null })
    expect(lots.find((l) => l.id === 9)?.statut).toBe('vendu')
  })
})
