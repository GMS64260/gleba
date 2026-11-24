import { describe, expect, it, vi } from 'vitest'
import { sortiesLotsComptes } from '@/lib/stocks/sorties-lots-comptes'

const comptage = new Date('2026-11-24T12:00:00.000Z')
const lots = [
  // Récolté le 20, compté le 24, perdu le 25 : retranché.
  { quantite: 2, date: new Date('2026-11-20T00:00:00.000Z'), createdAt: new Date('2026-11-20T08:00:00.000Z') },
  // Daté du 24 (jour du comptage) mais saisi le 24 à 16 h, après lui : jamais compté.
  { quantite: 5, date: new Date('2026-11-24T00:00:00.000Z'), createdAt: new Date('2026-11-24T15:00:00.000Z') },
  // Daté du 24, saisi le 24 à 9 h, avant le comptage : compté, retranché.
  { quantite: 3, date: new Date('2026-11-24T00:00:00.000Z'), createdAt: new Date('2026-11-24T08:00:00.000Z') },
  // Récolté le 22, saisi en retard le 26 : physiquement compté le 24, retranché.
  { quantite: 7, date: new Date('2026-11-22T00:00:00.000Z'), createdAt: new Date('2026-11-26T08:00:00.000Z') },
]

describe('sortiesLotsComptes', () => {
  it('retranche les lots comptés puis sortis, pas ceux saisis après le comptage le jour même', async () => {
    const findMany = vi.fn(async () => lots)
    expect(await sortiesLotsComptes({ recolte: { findMany } } as never, 'u1', 'Carotte', comptage, 'kg', [])).toBe(12)
    expect(findMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1', especeId: 'Carotte', date: { lte: comptage } })
  })

  it('sans comptage : rien à retrancher, sans lecture', async () => {
    const findMany = vi.fn()
    expect(await sortiesLotsComptes({ recolte: { findMany } } as never, 'u1', 'Carotte', null, 'kg', [])).toBe(0)
    expect(findMany).not.toHaveBeenCalled()
  })
})
