import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MOI,
  delegueMemoire,
  jeuReferentiel,
  sessionDe,
  type Ligne,
} from '@/lib/__tests__/fixtures/referentiel-memoire'

/**
 * Revue QA du 2026-10-20 — le champ « Stock actuel » de la fiche espèce
 * écrivait `Espece.inventaire`, colonne du référentiel PARTAGÉ que rien ne
 * lit, et ne la rechargeait jamais. La fiche sert désormais le stock DU COMPTE
 * (`UserStockEspece`, même calcul que Stocks > Récoltes) et le PUT n'accepte
 * plus `inventaire` ni `dateInventaire`.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  calculerStocksNet: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/stocks-helpers', () => ({ calculerStocksNet: mocks.calculerStocksNet }))

import { GET, PUT } from './route'

const especes = jeuReferentiel((id, nom) => ({
  id,
  nom,
  type: 'fleur',
  rendement: 30,
  uniteRendement: 'tiges_m2',
  prixKg: 1.2,
  inventaire: 999, // colonne partagée héritée : jamais servie, jamais écrite
}))
const lignesEspeces = (): Ligne[] =>
  Object.values(especes).map((e) => ({
    ...e,
    famille: null,
    varietes: [],
    itps: [],
    _count: { cultures: 0, recoltes: 0 },
  }))

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

const DATE_COMPTAGE = new Date('2026-10-01T10:00:00.000Z')
const ligneCompte = {
  rendement: null,
  uniteRendement: 'tiges_m2',
  objectifAnnuel: 500,
  prixKg: 2,
  inventaire: 10,
  dateInventaire: DATE_COMPTAGE,
}

let espece: ReturnType<typeof delegueMemoire>
let findUnique: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  espece = delegueMemoire(lignesEspeces())
  mocks.db.espece = espece
  findUnique = vi.fn(async () => ligneCompte)
  mocks.db.userStockEspece = { findMany: vi.fn(async () => []), findUnique }
  mocks.db.recolte = { groupBy: vi.fn(async () => []) }
  mocks.calculerStocksNet.mockResolvedValue({
    'gleba-1': {
      stockNet: 13,
      unite: 'tige',
      detail: { inventaire: 10, recoltes: 5, consommations: 2 },
      autresUnites: {},
    },
  })
})

describe('GET /api/especes/[id] — stock du compte', () => {
  it("sert `monStock` par le calcul de Stocks > Récoltes, avec le comptage du compte, jamais la colonne partagée", async () => {
    const res = await GET(requete('GET', '/api/especes/gleba-1'), params('gleba-1'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(mocks.calculerStocksNet).toHaveBeenCalledWith(MOI, 'gleba-1')
    expect(corps.monStock).toEqual({
      stockNet: 13,
      unite: 'tige',
      detail: { inventaire: 10, recoltes: 5, consommations: 2 },
      autresUnites: {},
      inventaire: 10,
      dateInventaire: DATE_COMPTAGE.toISOString(),
    })
    // Les réglages du compte restent à part, sans le comptage.
    expect(corps.monRendement).toEqual({
      rendement: null,
      uniteRendement: 'tiges_m2',
      objectifAnnuel: 500,
      prixKg: 2,
    })
    expect(corps.inventaire).toBe(999) // colonne héritée, encore servie mais plus lue par la fiche
  })

  it('sans comptage ni récolte chez ce compte : `monStock` vaut null, pas 0', async () => {
    findUnique.mockResolvedValue(null)
    mocks.calculerStocksNet.mockResolvedValue({})
    const res = await GET(requete('GET', '/api/especes/gleba-1'), params('gleba-1'))
    const corps = await res.json()
    expect(corps.monStock).toBeNull()
    expect(corps.monRendement).toBeNull()
  })
})

describe('PUT /api/especes/[id] — corps envoyé par l’ancienne fiche', () => {
  it("ignore `inventaire` et `dateInventaire` (colonnes partagées) et garde le reste", async () => {
    const res = await PUT(
      requete('PUT', '/api/especes/cm-moi', {
        prixKg: 3.5,
        objectifAnnuel: 50,
        inventaire: 12,
        dateInventaire: '2026-10-20',
      }),
      params('cm-moi'),
    )
    expect(res.status).toBe(200)
    expect(espece.update).toHaveBeenCalledTimes(1)
    const data = espece.update.mock.calls[0][0].data as Record<string, unknown>
    expect(data).not.toHaveProperty('inventaire')
    expect(data).not.toHaveProperty('dateInventaire')
    expect(data).toMatchObject({ prixKg: 3.5, objectifAnnuel: 50 })
  })
})
