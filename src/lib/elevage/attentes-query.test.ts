import { describe, expect, it, vi } from 'vitest'

const findMany = vi.hoisted(() => vi.fn())
vi.mock('@/lib/prisma', () => ({ default: { soinAnimal: { findMany } } }))

import { chargerAttentesConsolidees } from './attentes-query'

// Ticket cmulnl0wk (2026-09-28) : « supprimer le délai lait d’une chèvre morte ».
describe('délais d’attente des animaux sortis', () => {
  it('ne charge que les soins de lot ou d’animaux encore actifs', async () => {
    findMany.mockResolvedValue([])
    await chargerAttentesConsolidees('u', new Date('2026-10-02T00:00:00Z'))
    const where = findMany.mock.calls[0][0].where
    expect(where.AND).toEqual([{ OR: [{ animalId: null }, { animal: { statut: 'actif' } }] }])
  })
})
