import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ default: { lotFromage: { findMany } } }))

import { chargerCaveEnStock } from './stock-cave'

const lot = (surcharge: object) => ({
  id: 'lot-1', numeroLot: 'F-01', typeFromage: 'Tomme', nbPieces: 10, poidsTotalKg: 15,
  mouvements: [], ventesProduit: [], ...surcharge,
})

describe('chargerCaveEnStock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rend les lots encore en cave, bornés au compte et hors lots écoulés', async () => {
    findMany.mockResolvedValue([
      // 10 pièces, 4 vendues 8 € pièce : 6 restent, valorisées au prix constaté.
      lot({
        mouvements: [{ nbPieces: 4, poidsKg: 0 }],
        ventesProduit: [{ quantite: 4, unite: 'pièce', prixTotal: 32 }],
      }),
      // Lot dont toutes les pièces sont sorties : absent.
      lot({ id: 'lot-2', numeroLot: 'F-02', mouvements: [{ nbPieces: 10, poidsKg: 15 }] }),
    ])

    const cave = await chargerCaveEnStock('u1')

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1', etat: { not: 'ecoule' } } }))
    expect(cave).toHaveLength(1)
    expect(cave[0]).toMatchObject({ id: 'lot-1', stockPieces: 6, valorisation: 48 })
  })

  it('ne chiffre pas un lot sans vente payante', async () => {
    findMany.mockResolvedValue([lot({})])
    expect((await chargerCaveEnStock('u1'))[0]).toMatchObject({ stockPieces: 10, valorisation: null })
  })
})
