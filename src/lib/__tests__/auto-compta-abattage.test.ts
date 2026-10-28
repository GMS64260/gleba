// Générateur comptable réel, stockage simulé. Aucun module Prisma instancié.
import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ execute: vi.fn(), query: vi.fn(), find: vi.fn(), create: vi.fn(), remove: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {} }))

import { createVenteFromAbattage } from '@/lib/auto-compta'

const tx = {
  $executeRaw: m.execute,
  $queryRaw: m.query,
  venteManuelle: { findFirst: m.find, create: m.create, deleteMany: m.remove },
}
const source = { id: 31, destination: 'vente', prixVente: 100, date: new Date('2026-10-28'), quantite: 1 }

beforeEach(() => {
  vi.resetAllMocks()
  m.execute.mockResolvedValue(1)
  m.query.mockResolvedValue([]) // Aucun dossier ni versement détaillé.
  m.find.mockResolvedValue(null)
  m.create.mockImplementation(async ({ data }) => ({ id: 100, ...data }))
})

describe('Suivi du règlement des abattages', () => {
  it('P1 : une vente d’abattage est à encaisser par défaut', async () => {
    const result = await createVenteFromAbattage('review', source, tx as never)
    expect(result?.paye).toBe(false)
    expect(result?.montant).toBe(100)
  })

  it('P1 : régénérer le miroir conserve un abattage explicitement dépointé', async () => {
    const ancien = { paye: false, modeReglement: 'À crédit', notes: 'Non encaissé' }
    // Reproduit SELECT Prisma : seules les colonnes demandées sont renvoyées.
    m.find.mockImplementation(async ({ select }) => Object.fromEntries(
      Object.keys(select).filter((key) => key in ancien).map((key) => [key, ancien[key as keyof typeof ancien]]),
    ))
    const result = await createVenteFromAbattage('review', source, tx as never)
    expect(result?.paye).toBe(false)
    expect(result?.modeReglement).toBe('À crédit')
    expect(result?.notes).toBe('Non encaissé')
  })
})
