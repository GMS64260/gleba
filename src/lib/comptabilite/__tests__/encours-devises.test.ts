import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ factures: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {
  facture: { findMany: m.factures },
  venteProduit: { findMany: async () => [] }, venteManuelle: { findMany: async () => [] }, depenseManuelle: { findMany: async () => [] },
} }))
vi.mock('../projection-reglements', () => ({
  enrichirFacturesReglements: async (_u: string, rows: unknown[]) => rows,
  enrichirMiroirsReglements: async (_u: string, _n: string, rows: unknown[]) => rows,
  enrichirVentesElevageReglements: async (_u: string, rows: unknown[]) => rows,
}))
import { chargerEncoursCompta } from '../encours'
import { ventilerImpayeesParDevise } from '../ventilation-impayees'

beforeEach(() => {
  m.factures.mockReset().mockResolvedValueOnce([
    { id: 1, type: 'facture', date: new Date('2026-06-28'), statut: 'emise', totalTTC: 105.5, emetteurSnapshot: null },
    { id: 2, type: 'facture', date: new Date('2026-07-01'), statut: 'emise', totalTTC: 100, emetteurSnapshot: { devise: 'XPF' } },
  ]).mockResolvedValue([])
})
describe('encours publics : projection de l’identité des factures', () => {
  it('porte les devises sources même quand construireImpayees public ne les fournit pas', async () => {
    const encours = await chargerEncoursCompta('ferme', null, new Date('2026-12-31'), 'XPF')
    expect(encours.creances.total).toBe(205.5)
    expect(ventilerImpayeesParDevise(encours.creances.items, 'XPF')).toEqual([
      { monnaie: 'EUR', montant: 105.5 }, { monnaie: 'XPF', montant: 100 },
    ])
    expect(m.factures.mock.calls[0][0].where.userId).toBe('ferme')
  })
})
