/** PostgreSQL réel, données fictives sur gleba_tests ; aucune session HTTP simulée n'est une preuve d'autorisation. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import type { Culture, User } from '@prisma/client'
const auth = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: auth.userId } } }),
  getUserId: () => auth.userId,
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
import db from '@/lib/prisma'
import { PUT, PATCH } from './[id]/route'
import { POST } from './route'
import { checkAdjacence } from '@/lib/associations-adjacence'

const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const req = (method: string, data: Record<string, unknown>) => new NextRequest('http://localhost/api/cultures', {
  method, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' },
})
const jour = (date: string) => new Date(`${date}T00:00:00Z`)

// Même activation que les autres suites PostgreSQL : base jetable `gleba_tests`
// désignée à la fois par DATABASE_URL et TEST_DATABASE_URL (npm run test:integration).
const urlBase = process.env.DATABASE_URL
const active = !!urlBase && urlBase === process.env.TEST_DATABASE_URL && new URL(urlBase).pathname === '/gleba_tests'

describe.skipIf(!active)('occupation : concurrence PostgreSQL sous le verrou commun', () => {
  let user: User
  let especeId: string, plancheId: string, itpId: string
  beforeAll(async () => {
    if (new URL(process.env.DATABASE_URL || '').pathname !== '/gleba_tests'
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error('Base gleba_tests obligatoire')
    user = await db.user.create({ data: { email: `pr73-${randomUUID()}@example.invalid`, emailVerified: true } })
    auth.userId = user.id
    const espece = await db.espece.create({ data: { userId: user.id, nom: 'Espèce fictive PR73' } })
    especeId = espece.id
    const itp = await db.iTP.create({ data: { userId: user.id, especeId, nom: 'ITP fictif PR73', espacementRangs: 25 } })
    itpId = itp.id
    const planche = await db.planche.create({ data: { userId: user.id, nom: 'Planche fictive PR73', largeur: 0.8, longueur: 20 } })
    plancheId = planche.id
  })
  afterAll(async () => {
    if (user) await db.user.delete({ where: { id: user.id } })
    await db.$disconnect()
  })
  async function creer(extra: Partial<Culture> = {}) {
    return db.culture.create({ data: { userId: user.id, especeId, itpId, plancheId,
      annee: 2027, nbRangs: 1, longueur: 20, semisFait: false, plantationFaite: false, recolteFaite: false, dateSemis: jour('2027-03-01'), dateRecolte: jour('2027-09-01'), ...extra } })
  }
  async function attendreVerrous(nombre: number) {
    const fin = Date.now() + 7000
    while (Date.now() < fin) {
      const [{ n }] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_locks
        WHERE locktype = 'advisory' AND NOT granted
        AND objid = hashtext(${`gleba:creer-cultures:${user.id}`})::oid`
      if (n >= nombre) return
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
    throw new Error(`${nombre} mutations n'attendent pas le verrou d'exploitation`)
  }
  async function simultanees(actions: (() => Promise<Response>)[]) {
    let liberer!: () => void, verrouPris!: () => void
    const liberation = new Promise<void>((resolve) => { liberer = resolve })
    const acquisition = new Promise<void>((resolve) => { verrouPris = resolve })
    const bloqueur = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:creer-cultures:${user.id}`}))`
      verrouPris()
      await liberation
    }, { timeout: 15000 })
    await acquisition
    const reponses = actions.map((f) => f())
    let echec: unknown
    try {
      await attendreVerrous(actions.length)
    } catch (error) {
      echec = error
    } finally {
      liberer()
      await bloqueur
    }
    const res = await Promise.all(reponses)
    if (echec) throw echec
    console.log('Concurrence PostgreSQL réelle', res.map((r) => r.status))
    return res
  }
  it('une espèce privée B est indiscernable d’une espèce inconnue pour A, même face à une règle de famille publique', async () => {
    const { autre, famille, cachee, regle } = await db.$transaction(async (tx) => {
      const autre = await tx.user.create({ data: { email: `pr73-autre-${randomUUID()}@example.invalid`, emailVerified: true } })
      const famille = await tx.famille.create({ data: { id: `pr73-${randomUUID()}`, nomFr: 'Famille fictive PR73' } })
      const cachee = await tx.espece.create({ data: { userId: autre.id, familleId: famille.id, nom: 'Sélection secrète fictive B', partageCommunaute: false } })
      const regle = await tx.association.create({ data: { id: `pr73-${randomUUID()}`, nom: 'Règle publique fictive PR73', type: 'favorable', details: { create: [
        { especeId }, { familleId: famille.id },
      ] } } })
      return { autre, famille, cachee, regle }
    })
    try {
      await db.culture.deleteMany({ where: { userId: user.id } })
      await creer()
      const periode = { debut: jour('2027-04-01'), fin: jour('2027-08-01') }
      const resultat = await checkAdjacence(cachee.id, plancheId, user.id, db, jour('2027-06-01'), periode)
      expect(resultat).toEqual(await checkAdjacence('inexistante-pr73', plancheId, user.id, db, jour('2027-06-01'), periode))
      expect(resultat.alertes).toEqual([])
      expect(JSON.stringify(resultat)).not.toContain('Sélection secrète')
      // Contrôle positif : la famille doit continuer à déclencher chez son propriétaire.
      await db.espece.update({ where: { id: cachee.id }, data: { partageCommunaute: true } })
      const partagee = await checkAdjacence(cachee.id, plancheId, user.id, db, jour('2027-06-01'), periode)
      expect(partagee.alertes.some((a) => a.associationId === regle.id)).toBe(true)
      const compagnon = await db.espece.create({ data: { userId: user.id, nom: 'Compagne fictive PR73' } })
      await db.espece.update({ where: { id: cachee.id }, data: { partageCommunaute: false } })
      await db.associationDetail.deleteMany({ where: { associationId: regle.id } })
      await db.association.update({ where: { id: regle.id }, data: { details: { create: [
        { especeId: cachee.id, requise: true }, { especeId }, { especeId: compagnon.id },
      ] } } })
      const pivotMasque = await checkAdjacence(compagnon.id, plancheId, user.id, db, jour('2027-06-01'), periode)
      expect(pivotMasque.alertes).toEqual([])
      expect(pivotMasque.suggestions).toEqual([])
    } finally {
      await db.association.delete({ where: { id: regle.id } })
      await db.user.delete({ where: { id: autre.id } })
      await db.famille.delete({ where: { id: famille.id } })
    }
  })
  it('deux agrandissements PUT : un seul est accepté', async () => {
    await db.culture.deleteMany({ where: { userId: user.id } })
    const [a, b] = await Promise.all([creer(), creer()])
    const res = await simultanees([a, b].map((c) => () => PUT(req('PUT', { nbRangs: 3 }), params(c.id))))
    expect(res.map((r) => r.status).sort()).toEqual([200, 400])
    const cultures = await db.culture.findMany({ where: { userId: user.id } })
    expect(cultures.map((c) => c.nbRangs).sort()).toEqual([1, 3])
  })
  it('réactivation PATCH contre agrandissement PUT : une seule mutation est acceptée', async () => {
    await db.culture.deleteMany({ where: { userId: user.id } })
    const a = await creer(), b = await creer({ terminee: 'x', nbRangs: 3 })
    const res = await simultanees([
      () => PUT(req('PUT', { nbRangs: 3 }), params(a.id)),
      () => PATCH(req('PATCH', { terminee: null }), params(b.id)),
    ])
    expect(res.map((r) => r.status).sort()).toEqual([200, 400])
  })
  it('recalage PATCH contre agrandissement PUT : une seule mutation est acceptée', async () => {
    await db.culture.deleteMany({ where: { userId: user.id } })
    const a = await creer(), b = await creer({ nbRangs: 3, dateSemis: jour('2027-10-01'), dateRecolte: jour('2027-11-01') })
    const res = await simultanees([
      () => PUT(req('PUT', { nbRangs: 3 }), params(a.id)),
      () => PATCH(req('PATCH', { dateSemis: '2027-04-01' }), params(b.id)),
    ])
    expect(res.map((r) => r.status).sort()).toEqual([200, 400])
  })
  it('création POST contre agrandissement PUT : la création partage le verrou', async () => {
    await db.culture.deleteMany({ where: { userId: user.id } })
    const a = await creer()
    const res = await simultanees([
      () => PUT(req('PUT', { nbRangs: 3 }), params(a.id)),
      () => POST(req('POST', { especeId, itpId, plancheId, annee: 2027, nbRangs: 3,
        longueur: 20, semisFait: false, plantationFaite: false, recolteFaite: false, dateSemis: '2027-03-01', dateRecolte: '2027-09-01', confirmRotation: true })),
    ])
    expect(res.filter((r) => r.status === 200 || r.status === 201)).toHaveLength(1)
    expect(res.filter((r) => r.status === 400 || r.status === 409)).toHaveLength(1)
  })
})
