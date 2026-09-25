import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  lotFindFirst: vi.fn(),
  lotDelete: vi.fn(),
  animalCount: vi.fn(),
  animalFindMany: vi.fn(),
  animalUpdateMany: vi.fn(),
  soinFindMany: vi.fn(),
  soinDeleteMany: vi.fn(),
  consoFindMany: vi.fn(),
  consoDeleteMany: vi.fn(),
  depenseDeleteMany: vi.fn(),
  enregistrerChangementLot: vi.fn(),
  deleteAutoEntry: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/elevage/animal-lot', () => ({
  isOwnedParcelle: vi.fn(),
  enregistrerChangementLot: mocks.enregistrerChangementLot,
}))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({
  createDepenseFromLotAnimaux: vi.fn(),
  createDepenseFromAchatAnimal: vi.fn(),
  deleteAutoEntry: mocks.deleteAutoEntry,
}))
vi.mock('@/lib/prisma', () => {
  const tx = {
    animal: { findMany: mocks.animalFindMany, updateMany: mocks.animalUpdateMany },
    consommationAliment: { findMany: mocks.consoFindMany, deleteMany: mocks.consoDeleteMany },
    soinAnimal: { findMany: mocks.soinFindMany, deleteMany: mocks.soinDeleteMany },
    depenseManuelle: { deleteMany: mocks.depenseDeleteMany },
    lotAnimaux: { delete: mocks.lotDelete },
  }
  return {
    default: {
      $transaction: (callback: (t: unknown) => unknown) => callback(tx),
      lotAnimaux: { findFirst: mocks.lotFindFirst },
      animal: { count: mocks.animalCount },
    },
  }
})

import { DELETE } from './route'

const supprimer = () => DELETE(new NextRequest('http://localhost/api/elevage/lots?id=77', { method: 'DELETE' }))

const lot = (count: Record<string, number>, over: Record<string, unknown> = {}) => ({
  id: 77,
  nom: 'naissance 2024',
  prixAchatTotal: null,
  _count: { animaux: 0, abattages: 0, productionsOeufs: 0, soins: 0, consommations: 0, naissances: 0, ...count },
  ...over,
})

describe('DELETE /api/elevage/lots — lot dont tous les animaux sont sortis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'user-1' } } })
    mocks.soinFindMany.mockResolvedValue([])
    mocks.consoFindMany.mockResolvedValue([])
    mocks.animalFindMany.mockResolvedValue([{ id: 1 }, { id: 2 }])
  })

  it('détache les animaux sortis, tient leur historique, puis supprime le lot', async () => {
    mocks.lotFindFirst.mockResolvedValue(lot({ animaux: 12 }))
    mocks.animalCount.mockResolvedValue(0)

    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.animalUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', lotId: 77 },
      data: { lotId: null },
    })
    expect(mocks.enregistrerChangementLot).toHaveBeenCalledTimes(2)
    expect(mocks.enregistrerChangementLot).toHaveBeenCalledWith(
      expect.anything(), 'user-1', 1, 77, null, expect.any(Date), 'Suppression du lot',
    )
    expect(mocks.lotDelete).toHaveBeenCalledWith({ where: { id: 77 } })
  })

  it('refuse tant qu’un animal est encore présent, et dit comment faire', async () => {
    mocks.lotFindFirst.mockResolvedValue(lot({ animaux: 12 }))
    mocks.animalCount.mockResolvedValue(3)

    const res = await supprimer()

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('3 animal(aux) présent(s)')
    expect(mocks.lotDelete).not.toHaveBeenCalled()
  })

  it('garde un lot d’animaux sortis qui porte des soins (registre sanitaire)', async () => {
    mocks.lotFindFirst.mockResolvedValue(lot({ animaux: 12, soins: 3 }))
    mocks.animalCount.mockResolvedValue(0)

    const res = await supprimer()

    expect(res.status).toBe(409)
    expect(mocks.soinDeleteMany).not.toHaveBeenCalled()
    expect(mocks.lotDelete).not.toHaveBeenCalled()
  })

  it('garde un lot d’animaux sortis qui porte un prix d’achat (comptabilité)', async () => {
    mocks.lotFindFirst.mockResolvedValue(lot({ animaux: 12 }, { prixAchatTotal: 480 }))
    mocks.animalCount.mockResolvedValue(0)

    const res = await supprimer()

    expect(res.status).toBe(409)
    expect(mocks.deleteAutoEntry).not.toHaveBeenCalled()
  })

  it('supprime comme avant un lot créé par erreur, sans animal', async () => {
    mocks.lotFindFirst.mockResolvedValue(lot({}))

    const res = await supprimer()

    expect(res.status).toBe(200)
    expect(mocks.animalCount).not.toHaveBeenCalled()
    expect(mocks.animalUpdateMany).not.toHaveBeenCalled()
    expect(mocks.lotDelete).toHaveBeenCalled()
  })
})
