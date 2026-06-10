/**
 * BUG-21 — tests : surface allouée au prorata quand plusieurs cultures
 * partagent une même planche (sinon double comptage Carotte 30 m² +
 * Actinidia 30 m² sur B1 alors que B1 fait 30 m² réel).
 *
 * Bug #8 (testeur Marc, lot bugs-v4) : `getBesoinsSemences` ne porte plus
 * que sur les cultures RÉELLEMENT créées (`existante`). Les mocks passent
 * donc par des cultures directes (prisma.culture.findMany), plus par des
 * projections de rotation comme dans la version initiale du test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  default: {
    planche: { findMany: vi.fn() },
    espece: { findMany: vi.fn() },
    variete: { findMany: vi.fn() },
    userStockVariete: { findMany: vi.fn() },
    culture: { findMany: vi.fn() },
    iTP: { findMany: vi.fn() },
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
  iTP: { findMany: ReturnType<typeof vi.fn> }
}

function cultureDirecte(
  id: number,
  especeId: string,
  planche: { nom: string; longueur: number; largeur: number }
) {
  return {
    id,
    plancheId: planche.nom,
    planche: {
      nom: planche.nom,
      longueur: planche.longueur,
      largeur: planche.largeur,
      surface: planche.longueur * planche.largeur,
      ilot: null,
      rotationId: null,
    },
    itpId: null,
    itp: null,
    especeId,
    espece: { id: especeId, couleur: null, rendement: null },
    varieteId: null,
    variete: null,
    annee: 2026,
    dateSemis: null,
    datePlantation: null,
    dateRecolte: null,
    nbRangs: null,
    espacement: null,
    longueur: null,
  }
}

describe('getBesoinsSemences (BUG-21 prorata multi-cultures)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.planche.findMany.mockResolvedValue([])
    mocked.variete.findMany.mockResolvedValue([])
    mocked.userStockVariete.findMany.mockResolvedValue([])
    mocked.iTP.findMany.mockResolvedValue([])
  })

  it("Carotte + Actinidia sur la même planche : surface = surface_planche / 2 (Marc B1)", async () => {
    // Une planche de 30 m² occupée par 2 cultures réelles.
    mocked.culture.findMany.mockResolvedValue([
      cultureDirecte(1, 'carotte', { nom: 'B1', longueur: 10, largeur: 3 }),
      cultureDirecte(2, 'actinidia', { nom: 'B1', longueur: 10, largeur: 3 }),
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
    mocked.culture.findMany.mockResolvedValue([
      cultureDirecte(1, 'carotte', { nom: 'B1', longueur: 10, largeur: 3 }),
    ])
    mocked.espece.findMany.mockResolvedValue([
      { id: 'carotte', couleur: null, modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 80, margeSecuritePct: 25, famille: null },
    ])

    const besoins = await getBesoinsSemences('u1', 2026)
    const carotte = besoins.find(b => b.especeId === 'carotte')
    expect(carotte?.surfaceTotale).toBe(30) // surface complète
  })

  it("Carotte + Actinidia + Poireau sur la même planche : 1/3 chacun", async () => {
    mocked.culture.findMany.mockResolvedValue([
      cultureDirecte(1, 'carotte', { nom: 'B1', longueur: 12, largeur: 2.5 }), // 30 m²
      cultureDirecte(2, 'actinidia', { nom: 'B1', longueur: 12, largeur: 2.5 }),
      cultureDirecte(3, 'poireau', { nom: 'B1', longueur: 12, largeur: 2.5 }),
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
    mocked.culture.findMany.mockResolvedValue([
      cultureDirecte(1, 'carotte', { nom: 'B1', longueur: 10, largeur: 3 }),
      cultureDirecte(2, 'carotte', { nom: 'B2', longueur: 5, largeur: 4 }),
    ])
    mocked.espece.findMany.mockResolvedValue([
      { id: 'carotte', couleur: null, modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 80, margeSecuritePct: 0, famille: null },
    ])

    const besoins = await getBesoinsSemences('u1', 2026)
    const carotte = besoins.find(b => b.especeId === 'carotte')
    expect(carotte?.surfaceTotale).toBe(50) // 30 + 20
  })
})
