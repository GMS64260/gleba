/**
 * Jeu d'essai partagé des tests d'isolation du référentiel des récoltes
 * (revue 2026-10-20) : `src/app/api/recoltes/isolation-referentiel.test.ts`
 * (liste, filtre, création : dépôt public) et
 * `src/app/api/recoltes/[id]/isolation-referentiel.test.ts` (fiche, PUT,
 * PATCH : route de la zone privée). La base simulée rend ce que `include`
 * demande. Les tests branchent `mocks` par
 * `vi.mock('@/lib/prisma', async () => ({ default: (await import(…)).mocks.db }))`.
 */

import { NextRequest } from 'next/server'
import { expect, vi } from 'vitest'
import { MOI, delegueMemoire, jeuReferentiel, sessionDe, type Ligne } from './referentiel-memoire'

export const mocks = {
  requireAuthApi: vi.fn(),
  db: {} as Record<string, unknown>,
}

export const especes = jeuReferentiel((id, nom) => ({
  id, nom, type: 'legume', vivace: false, rendement: 2, uniteRendement: 'kg_m2', famille: null,
}))
export const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom: `Variété ${nom}`, especeId: id }))
export const itps = jeuReferentiel((id, nom) => ({ id: `i-${id}`, nom: `Itinéraire ${nom}`, especeId: id }))

/** Culture du compte conduite sur l'espèce partagée par un autre membre. */
export const culture = (): Ligne => ({
  id: 1174,
  userId: MOI,
  especeId: 'cm-partagee',
  varieteId: 'v-cm-partagee',
  itpId: 'i-cm-partagee',
  plancheId: null,
  dateSemis: new Date('2026-10-09T22:00:00.000Z'),
  datePlantation: new Date('2026-11-20T23:00:00.000Z'),
  dateRecolte: new Date('2027-01-15T23:00:00.000Z'),
  semisFait: false,
  plantationFaite: false,
  recolteFaite: false,
  espece: especes.partagee,
  variete: varietes.partagee,
  itp: itps.partagee,
  planche: null,
})

export const recolte = (): Ligne => ({
  id: 1150,
  userId: MOI,
  cultureId: 1174,
  especeId: 'cm-partagee',
  date: new Date('2027-01-20T12:00:00.000Z'),
  quantite: 25,
  unite: 'kg',
  statut: 'en_stock',
  prixKg: null,
  prixTotal: null,
  dateVente: null,
  clientId: null,
  clientNom: null,
  datePeremption: null,
  notes: null,
  factureId: null,
  statutBioSnapshot: null,
  espece: especes.partagee,
  culture: culture(),
})

export const params = (id: string) => ({ params: Promise.resolve({ id }) })
export const requete = (method: string, url: string, body?: object) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

/** Les champs que les écrans lisent sur l'espèce embarquée sortent, l'id tiers jamais. */
export function attendreEspeceMasquee(espece: Ligne) {
  expect(espece.userId).toBe('communaute')
  expect(espece.nom).toBe('Entrée partagée')
  expect(espece.uniteRendement).toBe('kg_m2')
}

/** Base en mémoire du scénario courant (réinitialisée par `preparerBase`). */
const base = {
  recoltes: delegueMemoire([]),
  cultures: delegueMemoire([]),
}
export const tx = { caisseLot: { findMany: async () => [] }, caisseAffectation: { findMany: vi.fn(async () => []) }, recolte: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() }, culture: { update: vi.fn(), findMany: vi.fn(async () => []) }, intervention: { findMany: vi.fn(async () => []) }, produitBoutique: { count: vi.fn(async () => 0) }, $queryRaw: vi.fn(async () => []), $executeRaw: vi.fn(async () => 1) }

/** À appeler dans `beforeEach`. */
export function preparerBase() {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue(sessionDe(MOI))
  base.recoltes = delegueMemoire([recolte()])
  base.cultures = delegueMemoire([culture()])
  mocks.db.recolte = { ...base.recoltes, groupBy: vi.fn(async () => []) }
  mocks.db.culture = base.cultures
  mocks.db.userStockEspece = { findMany: vi.fn(async () => []) }
  mocks.db.produitBoutique = { findFirst: vi.fn(async () => null), count: vi.fn(async () => 0) }
  tx.recolte.findFirst.mockImplementation(base.recoltes.findFirst)
  mocks.db.$transaction = async (fn: (t: typeof tx) => unknown) => fn(tx)
  // Comme Prisma : la ligne écrite revient avec ses relations incluses.
  tx.recolte.create.mockImplementation(async ({ data }: { data: Ligne }) => ({ ...recolte(), ...data, id: 1151 }))
  tx.recolte.update.mockImplementation(async ({ data }: { data: Ligne }) => ({ ...recolte(), ...data }))
}
