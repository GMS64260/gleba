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
 * Revue 2026-10-20 — la création d'un animal, sa fiche et ses modifications
 * renvoient la ligne complète de l'espèce animale : l'id de l'auteur d'un
 * profil partagé par un autre compte sortait. La liste et le PATCH de la
 * collection lisaient déjà l'espèce en `select`.
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}))

vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock('@/lib/prisma', () => ({ default: mocks.db }))
vi.mock('@/lib/elevage/animal-lot', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/elevage/animal-lot')>()),
  isAssignableAnimalLot: vi.fn(async () => true),
  enregistrerChangementLot: vi.fn(),
}))
vi.mock('@/lib/auto-compta', () => ({ createDepenseFromAchatAnimal: vi.fn(), deleteAutoEntry: vi.fn() }))

import { POST } from './route'
import { GET, PATCH, PUT } from './[id]/route'

const especes = jeuReferentiel((id, nom) => ({
  id, nom, type: 'mammifere_petit', filiere: 'rente', production: 'viande', productions: ['Viande'], couleur: '#a52', poidsAdulte: 60, dureeGestation: 150,
}))

/** Brebis du compte rattachée à l'espèce partagée par un autre membre. */
const animal = (): Ligne => ({
  id: 7,
  userId: MOI,
  especeAnimaleId: 'cm-partagee',
  lotId: null,
  nom: 'Belle',
  identifiant: 'FR001',
  race: null,
  raceAnimaleId: null,
  sexe: 'F',
  statut: 'actif',
  prixAchat: null,
  prixAchatInclusDansLot: false,
  dateArrivee: null,
  dateNaissance: null,
  dateSortie: null,
  parcelleGeoId: null,
  mereId: null,
  pereId: null,
  statutSanitaire: [],
  createdAt: new Date('2026-03-01T00:00:00.000Z'),
  especeAnimale: especes.partagee,
  lot: null,
  mere: null,
  pere: null,
  enfants: [],
  naissancesMere: [],
  sailliesFemelle: [],
  productionsOeufs: [],
  soins: [],
  abattages: [],
})

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

const attendreEspeceMasquee = (espece: Ligne) => {
  expect(espece).toMatchObject({ id: 'cm-partagee', nom: 'Entrée partagée', type: 'mammifere_petit', couleur: '#a52', poidsAdulte: 60, userId: 'communaute' })
}

let animaux: ReturnType<typeof delegueMemoire>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  animaux = delegueMemoire([animal()])
  const tx = {
    // Verrou des règlements pris en tête de transaction (`verrouillerReglements`).
    $executeRaw: vi.fn(),
    animal: {
      ...animaux,
      // Comme Prisma : la ligne créée revient avec ses relations incluses.
      create: vi.fn(async ({ data }: { data: Ligne }) => ({ ...animal(), ...data, id: 8 })),
    },
    mouvementCheptel: { create: vi.fn() },
  }
  Object.assign(mocks.db, {
    animal: animaux,
    especeAnimale: delegueMemoire(Object.values(especes)),
    exploitation: { findUnique: vi.fn(async () => ({ numeroEde: 'EDE-TEST' })) },
    soinAnimal: { findMany: vi.fn(async () => []) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  })
})

describe('POST /api/elevage/animaux — corps du formulaire animal', () => {
  it("l'animal créé revient avec son espèce masquée (201)", async () => {
    const res = await POST(requete('POST', '/api/elevage/animaux', { especeAnimaleId: 'cm-partagee', nom: 'Belle II', sexe: 'F' }))
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.data.id).toBe(8)
    attendreEspeceMasquee(corps.data.especeAnimale)
    expect(corps.data.userId).toBe(MOI)
    expect(JSON.stringify(corps)).not.toContain(AUTRE)
  })

  it("l'espèce privée d'un autre compte reste refusée (400) sans révéler son nom", async () => {
    const res = await POST(requete('POST', '/api/elevage/animaux', { especeAnimaleId: 'cm-privee' }))
    expect(res.status).toBe(400)
    expect(JSON.stringify(await res.json())).not.toContain('secrète')
  })
})

describe('GET / PATCH / PUT /api/elevage/animaux/[id]', () => {
  it('GET : fiche sans id tiers, soins et parents intacts', async () => {
    const res = await GET(requete('GET', '/api/elevage/animaux/7'), params('7'))
    expect(res.status).toBe(200)
    const { data } = await res.json()
    attendreEspeceMasquee(data.especeAnimale)
    expect(data).toMatchObject({ id: 7, userId: MOI, nom: 'Belle', soins: [] })
    expect(JSON.stringify(data)).not.toContain(AUTRE)
  })

  it('PATCH (poids) : réponse masquée', async () => {
    const res = await PATCH(requete('PATCH', '/api/elevage/animaux/7', { poidsActuel: 42 }), params('7'))
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.poidsActuel).toBe(42)
    attendreEspeceMasquee(data.especeAnimale)
    expect(JSON.stringify(data)).not.toContain(AUTRE)
  })

  it('PUT (nom) : réponse masquée', async () => {
    const res = await PUT(requete('PUT', '/api/elevage/animaux/7', { nom: 'Belle II' }), params('7'))
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.nom).toBe('Belle II')
    attendreEspeceMasquee(data.especeAnimale)
    expect(JSON.stringify(data)).not.toContain(AUTRE)
  })
})
