/**
 * Revue du 2026-11-01 — le graphique mensuel des Rapports relisait les tables
 * brutes : la somme de ses mois s'écartait du total comptable (achat de lot
 * oublié, consommations internes ajoutées). Les
 * mois se calculent désormais sur les écritures et les bornes des KPI.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/comptabilite/encours', () => ({ chargerEncoursCompta: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    venteManuelle: { findMany: vi.fn() },
    depenseManuelle: { findMany: vi.fn() },
    facture: { findMany: vi.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { bornesExerciceKpi, chargerMensuelCompta } from '../compta'

type AnyMock = ReturnType<typeof vi.fn>
const mocked = prisma as unknown as {
  venteManuelle: { findMany: AnyMock }
  depenseManuelle: { findMany: AnyMock }
  facture: { findMany: AnyMock }
}
const le = (mois: number, jour = 15) => new Date(2026, mois, jour, 10)

beforeEach(() => {
  vi.clearAllMocks()
  mocked.venteManuelle.findMany.mockResolvedValue([])
  mocked.depenseManuelle.findMany.mockResolvedValue([])
  mocked.facture.findMany.mockResolvedValue([])
})

describe('chargerMensuelCompta', () => {
  it('répartit les écritures comptables par mois, avoirs déduits', async () => {
    mocked.venteManuelle.findMany.mockResolvedValue([{ date: le(0), montant: 100 }, { date: le(2), montant: 40.5 }])
    mocked.facture.findMany.mockResolvedValue([
      { date: le(2), type: 'facture', totalTTC: 200 },
      { date: le(3), type: 'avoir', totalTTC: 20 },
    ])
    // Achat d'un lot (miroir automatique comptable) et facture de matériel.
    mocked.depenseManuelle.findMany.mockResolvedValue([{ date: le(1), montant: 550.59 }, { date: le(1), montant: 24.99 }])

    const mois = await chargerMensuelCompta('u1', 2026, new Date(2026, 10, 1, 12))

    expect(mois).toHaveLength(12)
    expect(mois[0]).toEqual({ revenus: 100, depenses: 0 })
    expect(mois[1]).toEqual({ revenus: 0, depenses: 575.58 })
    expect(mois[2]).toEqual({ revenus: 240.5, depenses: 0 })
    expect(mois[3]).toEqual({ revenus: -20, depenses: 0 })
  })

  it('lit le même périmètre et les mêmes bornes que le total comptable', async () => {
    const asOf = new Date(2026, 10, 1, 12)
    await chargerMensuelCompta('u1', 2026, asOf)

    const { debut, fin } = bornesExerciceKpi(2026, asOf)
    expect(fin).toBe(asOf)
    expect(mocked.depenseManuelle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', date: { gte: debut, lte: fin }, comptable: true },
    }))
    expect(mocked.venteManuelle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', date: { gte: debut, lte: fin } },
    }))
    expect(mocked.facture.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'u1', statut: { notIn: ['annulee', 'brouillon'] } }),
    }))
  })

  it("lit l'année entière d'un exercice passé", () => {
    expect(bornesExerciceKpi(2025, new Date(2026, 10, 1)).fin).toEqual(new Date(2025, 11, 31, 23, 59, 59, 999))
  })
})
