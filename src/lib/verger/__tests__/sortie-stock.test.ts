import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Revue du 2026-10-29 : depuis la livraison du 2026-10-28, une perte ou un
 * usage interne sur un lot jamais livré rendait son reliquat non nul. Le lot
 * était alors figé pour toujours (ni correction, ni suppression) et la sortie
 * ne pouvait plus être annulée, alors qu'une perte restait réversible avant.
 */

type Mouvement = { id: string; userId: string; nature: string; quantite: number; unite: string; date: Date
  fruitId: number | null; boisId: number | null; documentId: string | null; factureId: number | null }
type Lot = { id: number; userId: string; quantite: number; date: Date; statut: string; factureId: number | null
  stockDisponibleCommercial: number | null; numLot: string | null }

const etat = vi.hoisted(() => ({ lots: [] as Lot[], mouvements: [] as Mouvement[], verrous: [] as string[] }))

vi.mock('@/lib/stocks/verrou-commercial', () => ({ verrouillerStockCommercial: vi.fn(async () => { etat.verrous.push('ferme') }) }))
vi.mock('@/lib/kpi/cache', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/prisma', () => {
  const duLot = (where: { userId?: string; fruitId?: number }) => etat.mouvements.filter(m => m.userId === where.userId && m.fruitId === where.fruitId)
  const tx = {
    $queryRaw: vi.fn(async () => { etat.verrous.push('lot'); return [] }),
    recolteArbre: {
      findUnique: vi.fn(async ({ where }: { where: { id: number; userId: string } }) =>
        etat.lots.find(l => l.id === where.id && l.userId === where.userId) ?? null),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Partial<Lot> }) => {
        const lot = etat.lots.find(l => l.id === where.id)!
        Object.assign(lot, data)
        return { ...lot }
      }),
    },
    mouvementStockCommercial: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        etat.mouvements.find(m => m.id === where.id && m.userId === where.userId) ?? null),
      findMany: vi.fn(async ({ where }: { where: { userId: string; fruitId: number } }) => duLot(where)),
      count: vi.fn(async ({ where }: { where: { userId: string; fruitId: number } }) => duLot(where).length),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        etat.mouvements = etat.mouvements.filter(m => m.id !== where.id)
      }),
    },
  }
  return { default: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } }
})

import { annulerSortieVerger, etatSortiesLotVerger, lotVergerFige, reliquatApresCorrection } from '../sortie-stock'
import type { Prisma } from '@prisma/client'

const jour = new Date('2026-10-20T12:00:00Z')
const lot = (data: Partial<Lot> = {}): Lot => ({ id: 1, userId: 'u1', quantite: 10, date: jour, statut: 'en_stock', factureId: null,
  stockDisponibleCommercial: null, numLot: null, ...data })
const mouvement = (data: Partial<Mouvement> = {}): Mouvement => ({ id: 'perte-1', userId: 'u1', nature: 'perte', quantite: 2, unite: 'kg',
  date: new Date('2026-10-22T12:00:00Z'), fruitId: 1, boisId: null, documentId: null, factureId: null, ...data })

beforeEach(() => {
  etat.lots = []
  etat.mouvements = []
  etat.verrous = []
})

describe('lot figé par un document commercial uniquement', () => {
  const production = { quantite: 10, unite: 'kg' }
  it('un lot jamais sorti ou entamé par ses seules pertes reste libre', () => {
    expect(lotVergerFige(production, null, [], 0)).toBe(false)
    expect(lotVergerFige(production, 7, [{ quantite: 2, unite: 'kg' }, { quantite: 1, unite: 'kg' }], 0)).toBe(false)
  })
  it('un BL, une facture ou un reliquat inexpliqué figent le lot', () => {
    expect(lotVergerFige(production, 6, [], 1)).toBe(true)
    expect(lotVergerFige(production, 4, [{ quantite: 2, unite: 'kg' }], 1)).toBe(true)
    expect(lotVergerFige(production, 6, [], 0)).toBe(true)
    expect(lotVergerFige(production, 5, [{ quantite: 2, unite: 'kg' }], 0)).toBe(true)
  })
})

describe('correction d’un lot entamé par des sorties physiques', () => {
  const etatLot = async (stock: number) => {
    etat.lots = [lot({ stockDisponibleCommercial: stock })]
    return etatSortiesLotVerger({ mouvementStockCommercial: { findMany: async () => etat.mouvements } } as unknown as Prisma.TransactionClient,
      'u1', 'fruit', etat.lots[0] as never)
  }
  it('recalcule le reliquat quand la nouvelle quantité couvre les sorties', async () => {
    etat.mouvements = [mouvement()]
    const sorties = await etatLot(8)
    expect(sorties.fige).toBe(false)
    expect(reliquatApresCorrection(sorties, { quantite: 12, unite: 'kg', date: jour })).toBe(10)
    expect(reliquatApresCorrection(sorties, { quantite: 2, unite: 'kg', date: jour })).toBe(0)
  })
  it('refuse une quantité inférieure aux sorties ou une production postérieure à la première sortie', async () => {
    etat.mouvements = [mouvement()]
    const sorties = await etatLot(8)
    expect(() => reliquatApresCorrection(sorties, { quantite: 1.5, unite: 'kg', date: jour })).toThrow(/couvrir les sorties/)
    expect(() => reliquatApresCorrection(sorties, { quantite: 10, unite: 'kg', date: new Date('2026-10-23T12:00:00Z') })).toThrow(/antérieure/)
    expect(() => reliquatApresCorrection(sorties, { quantite: 10, unite: 'stère', date: jour })).toThrow(/comptées en kg/)
  })
})

describe('annulation d’une sortie physique', () => {
  it('rend la quantité et libère un lot jamais livré, sous les verrous ferme puis lot', async () => {
    etat.lots = [lot({ stockDisponibleCommercial: 8 })]
    etat.mouvements = [mouvement()]

    const resultat = await annulerSortieVerger('fruit', 'u1', 1, 'perte-1')

    expect(etat.verrous).toEqual(['ferme', 'lot'])
    expect(etat.mouvements).toHaveLength(0)
    expect(etat.lots[0].stockDisponibleCommercial).toBeNull()
    expect(resultat).toMatchObject({ dejaAnnulee: false, sortieAnnulee: { id: 'perte-1', nature: 'perte', quantite: 2 } })
  })

  it('après un BL, la quantité revient au reliquat sans libérer le lot', async () => {
    etat.lots = [lot({ stockDisponibleCommercial: 4 })]
    etat.mouvements = [mouvement({ id: 'bl-1', nature: 'livraison', quantite: 4, documentId: 'doc-1' }), mouvement()]

    await annulerSortieVerger('fruit', 'u1', 1, 'perte-1')

    expect(etat.lots[0].stockDisponibleCommercial).toBe(6)
    expect(etat.mouvements.map(m => m.id)).toEqual(['bl-1'])
  })

  it('une reprise réseau ne restitue rien une seconde fois', async () => {
    etat.lots = [lot({ stockDisponibleCommercial: 6 })]
    etat.mouvements = [mouvement({ id: 'perte-2', quantite: 2 }), mouvement({ id: 'perte-3', quantite: 2 })]

    await annulerSortieVerger('fruit', 'u1', 1, 'perte-2')
    const reprise = await annulerSortieVerger('fruit', 'u1', 1, 'perte-2')

    expect(reprise).toMatchObject({ dejaAnnulee: true, sortieAnnulee: null })
    expect(etat.lots[0].stockDisponibleCommercial).toBe(8)
  })

  it('refuse un mouvement de BL, la sortie d’un autre lot ou un lot d’un autre compte', async () => {
    etat.lots = [lot({ stockDisponibleCommercial: 6 }), lot({ id: 2, stockDisponibleCommercial: 8 })]
    etat.mouvements = [mouvement({ id: 'bl-1', nature: 'livraison', quantite: 4, documentId: 'doc-1' }), mouvement({ id: 'perte-2', fruitId: 2 })]

    await expect(annulerSortieVerger('fruit', 'u1', 1, 'bl-1')).rejects.toMatchObject({ status: 409 })
    await expect(annulerSortieVerger('fruit', 'u1', 1, 'perte-2')).rejects.toMatchObject({ status: 409 })
    await expect(annulerSortieVerger('fruit', 'u2', 1, 'perte-2')).rejects.toMatchObject({ status: 404 })
    expect(etat.mouvements).toHaveLength(2)
    expect(etat.lots.map(l => l.stockDisponibleCommercial)).toEqual([6, 8])
  })
})
