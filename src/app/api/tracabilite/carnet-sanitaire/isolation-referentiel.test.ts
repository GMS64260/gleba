import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTRE,
  MOI,
  delegueMemoire,
  jeuReferentiel,
  sessionDe,
  type Ligne,
} from '@/lib/__tests__/fixtures/referentiel-memoire'

/**
 * Revue 2026-10-20 — le carnet sanitaire lit l'espèce animale de l'animal et
 * du lot en `select { nom }` et la race en texte, puis compose ses propres
 * lignes : la ligne complète d'une espèce partagée par un autre compte ne
 * sort pas. Témoin : la base simulée porte la ligne complète.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/elevage/effectif', () => ({ reconstituerEffectifsLots: vi.fn(async () => new Map()) }))

import { GET } from './route'

const especes = jeuReferentiel((id, nom) => ({ id, nom, type: 'mammifere_petit', filiere: 'rente' }))

const soin = (): Ligne => ({
  id: 1,
  userId: MOI,
  date: new Date('2026-03-15T00:00:00.000Z'),
  type: 'Vermifuge',
  fait: true,
  animalId: 7,
  lotId: null,
  animal: {
    id: 7,
    userId: MOI,
    nom: 'Belle',
    identifiant: 'FR001',
    race: 'Lacaune',
    raceAnimale: { id: 'r-1', nom: 'Lacaune', userId: AUTRE, partageCommunaute: true },
    especeAnimale: especes.partagee,
  },
  lot: null,
  description: null,
  produit: 'Dectomax',
  quantite: null,
  unite: null,
  cout: null,
  veterinaire: null,
  datePrevue: null,
  notes: null,
})

let soins: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  soins = delegueMemoire([soin()])
  mocks.db.soinAnimal = soins
})

describe('GET /api/tracabilite/carnet-sanitaire', () => {
  it("le carnet nomme l'espèce et la race de l'animal sans l'id d'un autre compte", async () => {
    const res = await GET(new NextRequest('http://localhost/api/tracabilite/carnet-sanitaire?annee=2026'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.carnet).toHaveLength(1)
    expect(corps.carnet[0]).toMatchObject({ animalLot: 'Belle (Lacaune)', espece: 'Entrée partagée', produit: 'Dectomax' })
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
    expect(soins.findMany.mock.calls[0][0]?.include).toMatchObject({
      animal: { select: { especeAnimale: { select: { nom: true } } } },
      lot: { select: { especeAnimale: { select: { nom: true } } } },
    })
  })
})
