import { describe, expect, it, vi } from 'vitest'
import { resyncEcartementLait } from '../attente-lait'

describe('attente lait avec historique animal–lot', () => {
  it('utilise le lot à la date de collecte, pas le lot courant', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const db = {
      collecteLait: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'collecte-1', date: new Date('2026-01-05T00:00:00Z'),
          animalId: 7, lotId: null, ecarteAttente: false,
        }]),
        updateMany,
      },
      soinAnimal: {
        findMany: vi.fn().mockResolvedValue([{
          date: new Date('2026-01-01T12:00:00Z'),
          finAttenteLait: new Date('2026-01-07T00:00:00Z'),
          animalId: null, lotId: 1,
        }]),
      },
      animal: {
        // L'animal est maintenant dans le lot 2 : cette valeur ne doit pas
        // écraser son appartenance historique au lot 1 le 5 janvier.
        findMany: vi.fn().mockResolvedValue([{ id: 7, lotId: 2 }]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{
        animalId: 7, lotId: 1,
        dateDebut: new Date('2025-12-01T00:00:00Z'),
        dateFin: new Date('2026-01-10T00:00:00Z'),
      }]),
    }

    await resyncEcartementLait(
      db as never,
      'user-1',
      { animalIds: [7], lotIds: [1] },
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-07T00:00:00Z')
    )

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['collecte-1'] } },
      data: { ecarteAttente: true },
    })
  })

  it('conserve l’attente d’un soin de lot après le départ de l’animal', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const db = {
      collecteLait: { findMany: vi.fn().mockResolvedValue([{ id: 'c2', date: new Date('2026-01-05T00:00:00Z'), animalId: 8, lotId: null, ecarteAttente: false }]), updateMany },
      soinAnimal: { findMany: vi.fn().mockResolvedValue([{ date: new Date('2026-01-01T12:00:00Z'), finAttenteLait: new Date('2026-01-07T00:00:00Z'), animalId: null, lotId: 1 }]) },
      animal: { findMany: vi.fn().mockResolvedValue([{ id: 8, lotId: 2 }]) },
      $queryRaw: vi.fn().mockResolvedValue([
        { animalId: 8, lotId: 2, dateDebut: new Date('2026-01-03T00:00:00Z'), dateFin: null },
        { animalId: 8, lotId: 1, dateDebut: new Date('2025-12-01T00:00:00Z'), dateFin: new Date('2026-01-03T00:00:00Z') },
      ]),
    }
    await resyncEcartementLait(db as never, 'user-1', { animalIds: [8], lotIds: [1, 2] }, new Date('2026-01-01'), new Date('2026-01-07'))
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ['c2'] } }, data: { ecarteAttente: true } })
  })
})
