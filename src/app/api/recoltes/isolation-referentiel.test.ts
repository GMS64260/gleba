import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTRE, MOI, delegueMemoire } from '@/lib/__tests__/fixtures/referentiel-memoire'
import {
  attendreEspeceMasquee,
  especes,
  mocks,
  preparerBase,
  recolte,
  requete,
} from '@/lib/__tests__/fixtures/recoltes-referentiel-memoire'

/**
 * Revue 2026-10-20 — les récoltes embarquent la ligne complète de l'espèce et
 * (via la culture) de la variété et de l'ITP : l'id de l'auteur d'une entrée
 * partagée par un autre compte sortait dans la liste, la fiche et les
 * réponses d'écriture. La base simulée rend ce que `include` demande.
 *
 * Liste, filtre et création ici ; fiche, PUT et PATCH (route `[id]`, zone
 * privée) dans `./[id]/isolation-referentiel.test.ts`, sur le même jeu
 * d'essai : séparés pour que ce fichier reste dans le dépôt public
 * (livraison du 2026-11-16).
 */

vi.mock('@/lib/auth-utils', async () => ({ requireAuthApi: (await import('@/lib/__tests__/fixtures/recoltes-referentiel-memoire')).mocks.requireAuthApi }))
vi.mock('@/lib/prisma', async () => ({ default: (await import('@/lib/__tests__/fixtures/recoltes-referentiel-memoire')).mocks.db }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/auto-compta', () => ({ createVenteFromRecolte: vi.fn(), deleteAutoEntry: vi.fn() }))
vi.mock('@/lib/facture-utils', () => ({ creerFacture: vi.fn(), annulerFactureLiee: vi.fn() }))

import { GET as LISTE, POST } from './route'

// Horloge figée après les dates du jeu d'essai : une récolte ne se date pas
// dans le futur, et ces scénarios datent leurs récoltes jusqu'en janvier 2027.
beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2027-03-01T10:00:00.000Z')) })
afterAll(() => { vi.useRealTimers() })

beforeAll(() => { vi.stubEnv('TZ', 'Europe/Paris') })
afterAll(() => { vi.unstubAllEnvs() })

beforeEach(preparerBase)

describe('GET /api/recoltes — liste', () => {
  it("l'espèce et la variété d'un autre compte sortent masquées, avec leurs libellés", async () => {
    const res = await LISTE(requete('GET', '/api/recoltes?page=1&pageSize=50'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.data).toHaveLength(1)
    attendreEspeceMasquee(corps.data[0].espece)
    expect(corps.data[0].culture.variete).toMatchObject({ id: 'v-cm-partagee', nom: 'Variété Entrée partagée', userId: 'communaute' })
    expect(corps.data[0].userId).toBe(MOI)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})

describe('GET /api/recoltes — filtre des espèces', () => {
  it("joint les noms et exclut les espèces récoltées seulement par un autre compte", async () => {
    const officielles = { ...especes.gleba, nom: null }
    const recoltes = delegueMemoire([
      { ...recolte(), userId: MOI, especeId: 'cm-moi', espece: especes.moi },
      { ...recolte(), id: 1151, userId: MOI, especeId: 'gleba-1', espece: officielles },
      { ...recolte(), id: 1152, userId: AUTRE, especeId: 'cm-privee', espece: especes.privee },
    ])
    mocks.db.recolte = { ...recoltes, groupBy: vi.fn(async () => []) }
    const res = await LISTE(requete('GET', '/api/recoltes'))
    expect(res.status).toBe(200)
    expect((await res.json()).especes).toEqual([
      { id: 'cm-moi', nom: 'Entrée du compte' },
      { id: 'gleba-1', nom: null },
    ])
    expect(recoltes.findMany).toHaveBeenCalledWith({
      where: { userId: MOI },
      select: { especeId: true, espece: { select: { nom: true } } },
      distinct: ['especeId'],
      orderBy: { especeId: 'asc' },
    })
  })
})

describe('POST /api/recoltes — corps de /maraichage/recoltes/saisie', () => {
  it("la récolte créée revient avec son espèce masquée", async () => {
    const res = await POST(requete('POST', '/api/recoltes', {
      especeId: 'cm-partagee',
      cultureId: 1174,
      quantite: 25,
      date: new Date('2027-01-20T00:00:00.000Z'),
      datePeremption: null,
      notes: null,
    }))
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.id).toBe(1151)
    attendreEspeceMasquee(corps.espece)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })
})
