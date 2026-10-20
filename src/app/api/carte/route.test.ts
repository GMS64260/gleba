import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  parcelleFindMany: vi.fn(),
  lotFindMany: vi.fn(),
  animalFindMany: vi.fn(),
  reconstituerEffectifsLots: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: mocks.reconstituerEffectifsLots }))
vi.mock('@/lib/prisma', () => ({
  default: {
    parcelleGeo: { findMany: mocks.parcelleFindMany },
    lotAnimaux: { findMany: mocks.lotFindMany },
    animal: { findMany: mocks.animalFindMany },
  },
}))

import { GET } from './route'

// Revue 2026-10-20 — le bétail par parcelle lit l'effectif reconstitué du lot
// (écran Lots), pas le compteur stocké, sans compter deux fois une fiche du
// lot posée elle-même sur la carte.
describe('GET /api/carte — bétail par parcelle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: 'demo' } } })
    mocks.parcelleFindMany.mockResolvedValue([{ id: 'p1', nom: 'Prairie' }])
  })

  it('affiche le lot à son effectif reconstitué et compte chaque tête une fois', async () => {
    mocks.lotFindMany.mockResolvedValue([
      { id: 71, nom: 'Pintades perle A3 1708', parcelleGeoId: 'p1', quantiteInitiale: 2, quantiteActuelle: 5, especeAnimale: { nom: 'Pintade' } },
      { id: 9, nom: 'Chèvres', parcelleGeoId: 'p1', quantiteInitiale: 3, quantiteActuelle: 3, especeAnimale: { nom: 'Chèvre' } },
    ])
    mocks.animalFindMany.mockResolvedValue([
      { id: 1, nom: 'Blanchette', identifiant: null, parcelleGeoId: 'p1', lotId: 9, especeAnimale: { nom: 'Chèvre' } },
    ])
    mocks.reconstituerEffectifsLots.mockResolvedValue(new Map([
      [71, { effectifCalcule: 4 }],
      [9, { effectifCalcule: 3 }],
    ]))

    const [parcelle] = await (await GET()).json()

    expect(mocks.reconstituerEffectifsLots).toHaveBeenCalledWith('demo', expect.any(Array))
    expect(parcelle.betail.lots.map((l: { quantiteActuelle: number }) => l.quantiteActuelle)).toEqual([4, 3])
    // 4 pintades + 3 chèvres, dont Blanchette comptée une seule fois.
    expect(parcelle.betail.totalTetes).toBe(7)
    expect(parcelle.betail.parEspece).toEqual([
      { espece: 'Pintade', count: 4 },
      { espece: 'Chèvre', count: 3 },
    ])
  })
})
