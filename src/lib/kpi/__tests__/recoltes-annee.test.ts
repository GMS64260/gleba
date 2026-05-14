/**
 * BUG-03 — tests : agrégat unifié récoltes (réalisé + projection).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    recolte: { findMany: vi.fn() },
    culture: { findMany: vi.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { getRecoltesAnneeAggregat } from '../recoltes-annee'

type AnyMock = ReturnType<typeof vi.fn>
const mocked = prisma as unknown as {
  recolte: { findMany: AnyMock }
  culture: { findMany: AnyMock }
}

describe('getRecoltesAnneeAggregat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.recolte.findMany.mockResolvedValue([])
    mocked.culture.findMany.mockResolvedValue([])
  })

  it('renvoie 0 sur tous les champs quand aucune donnée', async () => {
    const agg = await getRecoltesAnneeAggregat('u1', 2026)
    expect(agg.realiseesKg).toBe(0)
    expect(agg.projectionKg).toBe(0)
    expect(agg.totalAttenduKg).toBe(0)
    expect(agg.parMois).toHaveLength(12)
    expect(agg.parEspece).toHaveLength(0)
  })

  it('somme les récoltes réelles sans projection (cohérent avec module Récoltes)', async () => {
    mocked.recolte.findMany.mockResolvedValue([
      { quantite: 50, date: new Date(2026, 5, 10), especeId: 'tomate', espece: { couleur: '#f00' } },
      { quantite: 40, date: new Date(2026, 6, 5), especeId: 'tomate', espece: { couleur: '#f00' } },
    ])
    const agg = await getRecoltesAnneeAggregat('u1', 2026)
    expect(agg.realiseesKg).toBe(90)
    expect(agg.projectionKg).toBe(0)
    expect(agg.totalAttenduKg).toBe(90)
    expect(agg.parMois[5].realiseesKg).toBe(50)  // juin
    expect(agg.parMois[6].realiseesKg).toBe(40)  // juillet
  })

  it('ajoute la projection cultures non récoltées (le cas Marc 0 vs 90)', async () => {
    mocked.recolte.findMany.mockResolvedValue([
      { quantite: 90, date: new Date(2026, 6, 1), especeId: 'tomate', espece: { couleur: null } },
    ])
    mocked.culture.findMany.mockResolvedValue([
      // 10 m² × 5 kg/m² = 50 kg projection
      {
        dateRecolte: new Date(2026, 7, 28), // août
        plancheId: 'p1',
        especeId: 'carotte',
        planche: { surface: 10, largeur: null, longueur: null },
        espece: { id: 'carotte', couleur: '#fa0', rendement: 5 },
      },
    ])
    const agg = await getRecoltesAnneeAggregat('u1', 2026)
    expect(agg.realiseesKg).toBe(90)
    expect(agg.projectionKg).toBe(50)
    expect(agg.totalAttenduKg).toBe(140)
  })

  it('fallback surface = largeur × longueur quand surface=null', async () => {
    mocked.culture.findMany.mockResolvedValue([
      {
        dateRecolte: new Date(2026, 6, 26),
        plancheId: 'p1',
        especeId: 'salade',
        planche: { surface: null, largeur: 2, longueur: 5 }, // = 10 m²
        espece: { id: 'salade', couleur: null, rendement: 3 },
      },
    ])
    const agg = await getRecoltesAnneeAggregat('u1', 2026)
    expect(agg.projectionKg).toBe(30) // 10 × 3
  })

  it('ignore une culture sans rendement (projection impossible)', async () => {
    mocked.culture.findMany.mockResolvedValue([
      {
        dateRecolte: new Date(2026, 6, 26),
        plancheId: 'p1',
        especeId: 'inconnue',
        planche: { surface: 100, largeur: null, longueur: null },
        espece: { id: 'inconnue', couleur: null, rendement: null },
      },
    ])
    const agg = await getRecoltesAnneeAggregat('u1', 2026)
    expect(agg.projectionKg).toBe(0)
  })

  it('agrège par espèce avec breakdown réalisé/projection', async () => {
    mocked.recolte.findMany.mockResolvedValue([
      { quantite: 30, date: new Date(2026, 5, 1), especeId: 'tomate', espece: { couleur: '#f00' } },
    ])
    mocked.culture.findMany.mockResolvedValue([
      {
        dateRecolte: new Date(2026, 6, 26),
        plancheId: 'p1',
        especeId: 'tomate',
        planche: { surface: 5, largeur: null, longueur: null },
        espece: { id: 'tomate', couleur: '#f00', rendement: 4 },
      },
    ])
    const agg = await getRecoltesAnneeAggregat('u1', 2026)
    expect(agg.parEspece).toHaveLength(1)
    expect(agg.parEspece[0]).toEqual({
      especeId: 'tomate',
      especeCouleur: '#f00',
      realiseesKg: 30,
      projectionKg: 20,
    })
  })
})
