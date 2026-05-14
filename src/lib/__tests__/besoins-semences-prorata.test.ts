/**
 * BUG-21 — tests : surface allouée au prorata quand plusieurs cultures
 * partagent une même planche (sinon double comptage Carotte 30 m² +
 * Actinidia 30 m² sur B1 alors que B1 fait 30 m² réel).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    planche: { findMany: vi.fn() },
    espece: { findMany: vi.fn() },
    variete: { findMany: vi.fn() },
    userStockVariete: { findMany: vi.fn() },
    culture: { findMany: vi.fn() },
  },
}))

import prisma from '@/lib/prisma'
import { getBesoinsSemences } from '../planification'

const mocked = prisma as unknown as {
  planche: { findMany: ReturnType<typeof vi.fn> }
  espece: { findMany: ReturnType<typeof vi.fn> }
  variete: { findMany: ReturnType<typeof vi.fn> }
  userStockVariete: { findMany: ReturnType<typeof vi.fn> }
  culture: { findMany: ReturnType<typeof vi.fn> }
}

function plancheAvecRotation(nom: string, longueur: number, largeur: number, details: { itpId: string; especeId: string }[]) {
  return {
    nom,
    longueur,
    largeur,
    surface: longueur * largeur,
    ilot: null,
    rotationId: 'r1',
    rotation: {
      nbAnnees: 1,
      details: details.map((d, i) => ({
        annee: 1,
        itpId: d.itpId,
        itp: {
          id: d.itpId,
          especeId: d.especeId,
          semaineSemis: 12,
          semainePlantation: null,
          semaineRecolte: 30,
          dureeCulture: null,
          nbRangs: 2,
          espacement: 50,
          espece: { id: d.especeId, couleur: null },
        },
      })),
    },
    cultures: [],
  }
}

describe('getBesoinsSemences (BUG-21 prorata multi-cultures)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.variete.findMany.mockResolvedValue([])
    mocked.userStockVariete.findMany.mockResolvedValue([])
    mocked.culture.findMany.mockResolvedValue([])
  })

  it("Carotte + Actinidia sur la même planche : surface = surface_planche / 2 (Marc B1)", async () => {
    // Une planche de 30 m² avec 2 ITPs dans la même année de rotation.
    mocked.planche.findMany.mockResolvedValue([
      plancheAvecRotation('B1', 10, 3, [
        { itpId: 'itp_carotte', especeId: 'carotte' },
        { itpId: 'itp_actinidia', especeId: 'actinidia' },
      ]),
    ])
    mocked.espece.findMany.mockResolvedValue([
      { id: 'carotte', couleur: null, modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 80, margeSecuritePct: 25, famille: null },
      { id: 'actinidia', couleur: null, modeSemis: 'bouture', doseSemis: null, uniteDose: null, tauxGermination: null, margeSecuritePct: 15, famille: null },
    ])

    const besoins = await getBesoinsSemences('u1', 2026)

    const carotte = besoins.find(b => b.especeId === 'carotte')
    expect(carotte).toBeDefined()
    // Surface planche = 30 m² / 2 cultures = 15 m² au prorata pour la carotte.
    expect(carotte?.surfaceTotale).toBe(15)
  })

  it('Carotte seule sur planche : surface entière conservée (pas de division parasite)', async () => {
    mocked.planche.findMany.mockResolvedValue([
      plancheAvecRotation('B1', 10, 3, [{ itpId: 'itp_carotte', especeId: 'carotte' }]),
    ])
    mocked.espece.findMany.mockResolvedValue([
      { id: 'carotte', couleur: null, modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 80, margeSecuritePct: 25, famille: null },
    ])

    const besoins = await getBesoinsSemences('u1', 2026)
    const carotte = besoins.find(b => b.especeId === 'carotte')
    expect(carotte?.surfaceTotale).toBe(30) // surface complète
  })

  it("Carotte + Actinidia + Poireau sur la même planche : 1/3 chacun", async () => {
    mocked.planche.findMany.mockResolvedValue([
      plancheAvecRotation('B1', 12, 2.5, [ // 30 m²
        { itpId: 'itp_a', especeId: 'carotte' },
        { itpId: 'itp_b', especeId: 'actinidia' },
        { itpId: 'itp_c', especeId: 'poireau' },
      ]),
    ])
    mocked.espece.findMany.mockResolvedValue([
      { id: 'carotte', couleur: null, modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 80, margeSecuritePct: 0, famille: null },
      { id: 'actinidia', couleur: null, modeSemis: 'bouture', doseSemis: null, uniteDose: null, tauxGermination: null, margeSecuritePct: 0, famille: null },
      { id: 'poireau', couleur: null, modeSemis: 'plant_repique', doseSemis: 1, uniteDose: 'graines_plant', tauxGermination: 80, margeSecuritePct: 0, famille: null },
    ])

    const besoins = await getBesoinsSemences('u1', 2026)
    const carotte = besoins.find(b => b.especeId === 'carotte')
    // 30 m² / 3 = 10 m² ; pas 30 (le double comptage donnait 30 partout).
    expect(carotte?.surfaceTotale).toBe(10)
  })

  it('cultures sur planches différentes : pas de division (chacune sa planche)', async () => {
    mocked.planche.findMany.mockResolvedValue([
      plancheAvecRotation('B1', 10, 3, [{ itpId: 'itp_carotte', especeId: 'carotte' }]),
      plancheAvecRotation('B2', 5, 4, [{ itpId: 'itp_carotte', especeId: 'carotte' }]),
    ])
    mocked.espece.findMany.mockResolvedValue([
      { id: 'carotte', couleur: null, modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 80, margeSecuritePct: 0, famille: null },
    ])

    const besoins = await getBesoinsSemences('u1', 2026)
    const carotte = besoins.find(b => b.especeId === 'carotte')
    expect(carotte?.surfaceTotale).toBe(50) // 30 + 20
  })
})
