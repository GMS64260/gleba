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
 * Revue 2026-10-20 — la liste des naissances lit l'espèce animale de la mère
 * et du lot en `select` (id, nom, filière, durées) et la race de la mère en
 * texte : la ligne complète d'une espèce partagée par un autre compte, et
 * donc l'id de son auteur, ne sort pas. Témoin : la base simulée porte la
 * ligne complète, la réponse ne la rend pas.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))

import { GET } from './route'

const especes = jeuReferentiel((id, nom) => ({
  id, nom, type: 'mammifere_petit', filiere: 'rente', dureeGestation: 150, dureeCouvaison: null,
}))

const naissance = (): Ligne => ({
  id: 1,
  userId: MOI,
  date: new Date('2026-03-01T00:00:00.000Z'),
  nombreNes: 3,
  nombreVivants: 3,
  nombreMales: 1,
  nombreFemelles: 2,
  mere: {
    id: 7,
    userId: MOI,
    nom: 'Belle',
    identifiant: 'FR001',
    race: 'Lacaune',
    raceAnimale: { id: 'r-1', nom: 'Lacaune', userId: AUTRE, partageCommunaute: true },
    especeAnimale: especes.partagee,
  },
  lot: { id: 3, userId: MOI, nom: 'Agnelles 2026', especeAnimale: especes.partagee },
  petits: [],
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  mocks.db.naissanceAnimale = {
    ...delegueMemoire([naissance()]),
    aggregate: vi.fn(async () => ({
      _count: 1,
      _sum: { nombreNes: 3, nombreVivants: 3, nombreMales: 1, nombreFemelles: 2 },
    })),
  }
})

describe('GET /api/elevage/naissances', () => {
  it("l'espèce de la mère et du lot sortent par leurs champs d'écran, sans l'id de leur auteur", async () => {
    const res = await GET(new NextRequest('http://localhost/api/elevage/naissances?annee=2026'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.data).toHaveLength(1)
    const { mere, lot } = corps.data[0]
    expect(mere.especeAnimale).toEqual({ id: 'cm-partagee', nom: 'Entrée partagée', filiere: 'rente', dureeGestation: 150, dureeCouvaison: null })
    expect(lot.especeAnimale).toEqual({ id: 'cm-partagee', nom: 'Entrée partagée', filiere: 'rente' })
    expect(mere.race).toBe('Lacaune')
    expect(mere.raceAnimale).toBeUndefined()
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})
