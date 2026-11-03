/**
 * Régressions des saisies : PostgreSQL migré, données synthétiques seulement.
 * DATABASE_URL = GLEBA_SAISIES_QA_DATABASE_URL ; base gleba_saisies_qa_<8 hex>.
 * Exécution : scripts/qa/controle-borne.sh avec vitest-saisies.config.mjs.
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({ tenant: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: vi.fn(async () => ({ error: null, session: { user: { id: auth.tenant } } })),
  getUserId: (session: { user: { id: string } }) => session.user.id,
}))
vi.mock('@/lib/irrigation/a-arroser', () => ({
  chargerTourneeDuJour: vi.fn(async () => ({ lignes: [], nbCultures: 0, horsTournee: [] })),
}))
vi.mock('@/lib/terroir', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/terroir')>()),
  zoneEffectiveUser: vi.fn(async () => null),
}))

import db from '@/lib/prisma'
import { POST as creerCulture } from '@/app/api/cultures/route'
import { PATCH as patchCulture, PUT as putCulture } from '@/app/api/cultures/[id]/route'
import { GET as statsElevage } from '@/app/api/elevage/stats/route'
import { GET as productionsOeufs } from '@/app/api/elevage/production-oeufs/route'
import { GET as analyseCouts } from '@/app/api/elevage/analyse-couts/route'
import { getTachesPotager } from '@/lib/taches-potager'
import { dateJourSeul } from '@/lib/jour-civil'

const reference = new Date('2026-11-03T12:00:00Z')
const aujourdHui = dateJourSeul(reference)
const annee = aujourdHui.getUTCFullYear()
const jour = (decalage: number) => {
  const date = new Date(aujourdHui)
  date.setUTCDate(date.getUTCDate() + decalage)
  return date
}
let userId: string, especeId: string
const req = (path: string, method = 'GET', body?: Record<string, unknown>) => new NextRequest(
  'http://localhost' + path,
  { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) },
)
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

beforeAll(() => {
  const url = process.env.DATABASE_URL || ''
  if (!/^\/gleba_saisies_qa_[0-9a-f]{8}$/.test(new URL(url).pathname)
    || process.env.GLEBA_SAISIES_QA_DATABASE_URL !== url) {
    throw new Error('Base PostgreSQL jetable dédiée obligatoire')
  }
  // Seul Date est simulé : les timers du client PostgreSQL restent réels.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(reference)
})
beforeEach(async () => {
  const user = await db.user.create({ data: { email: `saisies-${randomUUID()}@example.com` } })
  userId = user.id
  auth.tenant = userId
  const espece = await db.espece.create({ data: { userId, nom: 'Légume témoin' } })
  especeId = espece.id
})
afterAll(async () => {
  vi.useRealTimers()
  await db.$disconnect()
})

it('refuse une fenêtre inversée à la création sans insérer de culture', async () => {
  const res = await creerCulture(req('/api/cultures', 'POST', {
    especeId, dateRecolte: jour(10).toISOString(), finRecolte: jour(5).toISOString(),
    semisFait: false, plantationFaite: false, recolteFaite: false,
  }))
  expect(res.status).toBe(400)
  expect((await res.json()).error).toMatch(/fin.*récolte/i)
  expect(await db.culture.count({ where: { userId } })).toBe(0)
})

it.each(['PUT', 'PATCH'] as const)('%s refuse la fin inversée et accepte de fermer la fenêtre le jour de son début', async (method) => {
  const culture = await db.culture.create({ data: {
    userId, especeId, annee, dateRecolte: jour(10), finRecolte: jour(20),
  } })
  const modifier = method === 'PUT' ? putCulture : patchCulture
  const refus = await modifier(req('/api/cultures/' + culture.id, method, {
    finRecolte: jour(5).toISOString(),
  }), params(culture.id))
  expect(refus.status).toBe(400)
  expect((await db.culture.findUniqueOrThrow({ where: { id: culture.id } })).finRecolte).toEqual(jour(20))
  const accepte = await modifier(req('/api/cultures/' + culture.id, method, {
    finRecolte: jour(10).toISOString(),
  }), params(culture.id))
  expect(accepte.status).toBe(200)
  expect((await db.culture.findUniqueOrThrow({ where: { id: culture.id } })).finRecolte).toEqual(jour(10))
  auth.tenant = 'autre-exploitation'
  expect((await modifier(req('/api/cultures/' + culture.id, method, {
    finRecolte: jour(20).toISOString(),
  }), params(culture.id))).status).toBe(404)
})

it('garde la récolte ouverte visible sans retard, compte seulement la fenêtre dépassée', async () => {
  const cultures = await Promise.all([5, 0, -2].map(fin => db.culture.create({ data: {
    userId, especeId, annee, dateRecolte: jour(-10), finRecolte: jour(fin),
    plantationFaite: true,
  } })))
  const taches = await getTachesPotager(userId, {
    start: new Date(new Date().setHours(0, 0, 0, 0)),
    end: new Date(new Date().setHours(23, 59, 59, 999)), annee,
  })
  expect(taches.recoltes.map(r => r.id).sort()).toEqual(cultures.map(c => c.id).sort())
  expect(taches.recoltes.map(r => r.retardJours).sort()).toEqual([0, 0, 2])
  expect(taches.stats.enRetard).toBe(1)
})

async function lotPondeuses() {
  const espece = await db.especeAnimale.create({ data: {
    id: `poule_${randomUUID()}`, userId, nom: 'Pondeuse témoin', type: 'volaille', production: 'oeufs',
  } })
  return db.lotAnimaux.create({ data: {
    userId, especeAnimaleId: espece.id, nom: 'Lot témoin', quantiteInitiale: 60, quantiteActuelle: 60,
  } })
}

it('recoupe sur PostgreSQL stock, production annuelle, graphique et coût par œuf sans la ponte future', async () => {
  const lot = await lotPondeuses()
  await db.productionOeuf.createMany({ data: [
    { userId, lotId: lot.id, date: jour(0), quantite: 20 },
    { userId, lotId: lot.id, date: jour(1), quantite: 44 },
  ] })
  const statsRes = await statsElevage(req(`/api/elevage/stats?annee=${annee}`))
  expect(statsRes.status).toBe(200)
  const stats = await statsRes.json()
  expect(stats.stats.productionOeufsAnnee).toBe(20)
  expect(stats.stats.stockOeufsDetail.produits).toBe(20)
  expect(stats.productionOeufsMois.reduce((n: number, m: { total: number }) => n + m.total, 0)).toBe(20)
  const productions = await (await productionsOeufs(req(`/api/elevage/production-oeufs?annee=${annee}`))).json()
  expect(productions.stats.total).toBe(20)
  expect(productions.data).toHaveLength(2)
  const couts = await (await analyseCouts(req(`/api/elevage/analyse-couts?annee=${annee}`))).json()
  expect(couts.data[0].metriques.totalOeufs).toBe(20)
  expect(couts.ateliers[0].production.oeufs).toBe(20)
  auth.tenant = 'autre-exploitation'
  const autre = await (await statsElevage(req(`/api/elevage/stats?annee=${annee}`))).json()
  expect(autre.stats.productionOeufsAnnee).toBe(0)
})

it.each([0.3, 0])('recoupe le coût du lot et de son atelier au coût de ferme de %s €/kg', async coutUnitaire => {
  const lot = await lotPondeuses()
  const aliment = await db.aliment.create({ data: { id: randomUUID(), nom: 'Aliment témoin', prix: 0.8 } })
  await db.userStockAliment.create({ data: { userId, alimentId: aliment.id, coutUnitaire, prix: 0.5 } })
  await db.consommationAliment.create({ data: { userId, lotId: lot.id, alimentId: aliment.id, quantite: 100, date: jour(0) } })
  const res = await analyseCouts(req(`/api/elevage/analyse-couts?annee=${annee}`))
  expect(res.status).toBe(200)
  const couts = await res.json()
  expect(couts.data[0].couts.alimentation).toBe(100 * coutUnitaire)
  expect(couts.ateliers[0].couts.alimentation).toBe(couts.data[0].couts.alimentation)
})
