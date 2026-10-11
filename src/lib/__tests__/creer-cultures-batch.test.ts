/**
 * Revue du 2026-10-11 (QA cmv2r2rl8, cmv2r1v63) — « Créer quand même » une étape
 * de rotation non suivie passe par `creerCulturesBatch` : la même règle
 * d'occupation que POST /api/cultures s'y applique. Corps rejoué : celui que
 * l'écran Créer les cultures envoie (planche par son nom, ITP, année).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  itpFindMany: vi.fn(),
  plancheFindMany: vi.fn(),
  cultureFindFirst: vi.fn(),
  cultureCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    iTP: { findMany: mocks.itpFindMany },
    planche: { findMany: mocks.plancheFindMany },
    culture: { findFirst: mocks.cultureFindFirst, create: mocks.cultureCreate },
  },
}))
// Mock partiel : `calendrier-climat` dérive ses zones de `terroir` au chargement.
vi.mock('@/lib/terroir', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/terroir')>()),
  zoneEffectiveUser: vi.fn().mockResolvedValue(null),
}))

import { creerCulturesBatch } from '../planification'

const ITP_OIGNON = {
  id: 'Oignon-printemps',
  especeId: 'Oignon',
  espece: { id: 'Oignon', vivace: false },
  userId: null,
  zoneClimat: null,
  semaineSemis: 10,
  semainePlantation: 14,
  semaineRecolte: 28,
  semaineRecolteFin: 32,
  dureeRecolte: 4,
  nbRangs: 4,
  espacement: 10,
  espacementRangs: 25,
}

// Planche de 0,90 m : radis (4 rangs, espacement inconnu → 0,10 m) et zinnia
// d'un rang en place sur la période de l'oignon.
const planche = (cultures: unknown[], largeur = 0.9) => ({
  id: 'cmv2epoyb000vriklr0lp3chn',
  nom: 'Marc-v7-QA2-1010',
  largeur,
  longueur: 24,
  cultures,
})
const enPlace = (id: number, nbRangs: number, espacementRangs: number | null) => ({
  id,
  espece: { id: `e${id}`, vivace: false },
  nbRangs,
  itp: { espacementRangs },
  dateSemis: new Date('2027-01-01T00:00:00Z'),
  datePlantation: null,
  dateRecolte: new Date('2027-09-01T00:00:00Z'),
  finRecolte: null,
})

describe('creerCulturesBatch — occupation de la planche', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.itpFindMany.mockResolvedValue([ITP_OIGNON])
    mocks.cultureFindFirst.mockResolvedValue(null)
    mocks.cultureCreate.mockImplementation(async ({ data }) => ({ id: 2001, ...data }))
  })

  it("écarte une étape qui ne tient pas, avec le motif et l'ajustement", async () => {
    mocks.plancheFindMany.mockResolvedValue([planche([enPlace(1173, 4, null), enPlace(1174, 1, 35)])])

    const r = await creerCulturesBatch('u1', [{ plancheId: 'Marc-v7-QA2-1010', itpId: 'Oignon-printemps', annee: 2027 }])

    expect(r.created).toBe(0)
    expect(mocks.cultureCreate).not.toHaveBeenCalled()
    expect(r.ignorees[0].motif).toMatch(/Largeur insuffisante : besoin de 0\.75m, disponible 0\.50m/)
    // 3 rangs × 25 cm = 0,50 m : un ajustement exact tient (pas d'arrondi flottant).
    expect(r.ignorees[0].motif).toMatch(/réduire à 3 rangs/)
  })

  it('crée quand elle tient, avec la fenêtre de récolte de l’ITP', async () => {
    mocks.plancheFindMany.mockResolvedValue([planche([enPlace(1174, 1, 35)], 1.2)])

    const r = await creerCulturesBatch('u1', [{ plancheId: 'Marc-v7-QA2-1010', itpId: 'Oignon-printemps', annee: 2027 }])

    expect(r.created).toBe(1)
    const data = mocks.cultureCreate.mock.calls[0][0].data
    expect(data.nbRangs).toBe(4)
    expect(data.finRecolte).toBeInstanceOf(Date)
    expect(data.finRecolte.getTime()).toBeGreaterThan(data.dateRecolte.getTime())
  })
})
