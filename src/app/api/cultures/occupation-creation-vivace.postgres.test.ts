/**
 * PostgreSQL réel, données fictives sur gleba_tests ; l'authentification est
 * simulée (aucune preuve de garde HTTP ici).
 *
 * Contre-revue PR #73 (revue-adv-183) : la création évaluait toute nouvelle
 * culture comme une annuelle, bornée à sa fenêtre de récolte. Une vivace
 * créée de janvier à février sur une planche où une annuelle occupe juin-août
 * passait, alors qu'elle reste en place et prend la largeur de l'annuelle.
 * Les deux sondes de la contre-revue sont reprises ici, avec l'aperçu de
 * l'assistant et le témoin annuel.
 *
 * Planche de 20 m × 0,80 m, marges 0,20 m : une culture de 3 rangs à 25 cm
 * (0,50 m) tient seule ; deux en même temps (1,00 m) débordent.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
const auth = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: auth.userId } } }),
  getUserId: () => auth.userId,
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
import db from '@/lib/prisma'
import { POST } from './route'
import { GET as occupation } from './occupation/route'
import { creerCulturesBatch } from '@/lib/planification'

const jour = (iso: string) => new Date(iso + 'T00:00:00.000Z')

// Même activation que les autres suites PostgreSQL : base jetable `gleba_tests`
// désignée à la fois par DATABASE_URL et TEST_DATABASE_URL (npm run test:integration).
const urlBase = process.env.DATABASE_URL
const active = !!urlBase && urlBase === process.env.TEST_DATABASE_URL && new URL(urlBase).pathname === '/gleba_tests'

describe.skipIf(!active)('occupation : une nouvelle vivace est évaluée vivace à la création', () => {
  let userId: string, vivaceId: string, annuelleId: string, itpVivaceId: string, itpAnnuelId: string
  let itpSansEspeceId: string, plancheId: string, eteId: string, itpEteId: string
  beforeAll(async () => {
    if (new URL(process.env.DATABASE_URL || '').pathname !== '/gleba_tests'
      || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error('Base gleba_tests obligatoire')
    userId = (await db.user.create({ data: { email: `pr73-creation-${randomUUID()}@example.invalid`, emailVerified: true } })).id
    auth.userId = userId
    vivaceId = (await db.espece.create({ data: { userId, nom: 'Vivace fictive PR73 création', vivace: true } })).id
    annuelleId = (await db.espece.create({ data: { userId, nom: 'Annuelle fictive PR73 création', vivace: false } })).id
    itpVivaceId = (await db.iTP.create({ data: { userId, especeId: vivaceId, nom: 'ITP vivace fictif PR73', nbRangs: 3, espacementRangs: 25, semaineSemis: 1, semaineRecolte: 5 } })).id
    itpAnnuelId = (await db.iTP.create({ data: { userId, especeId: annuelleId, nom: 'ITP annuel fictif PR73', nbRangs: 3, espacementRangs: 25, semaineSemis: 1, semaineRecolte: 5 } })).id
    // Espèce distincte pour la culture en place : le lot écarte une seconde
    // culture de la même espèce sur la planche dans l'année.
    eteId = (await db.espece.create({ data: { userId, nom: 'Annuelle d’été fictive PR73', vivace: false } })).id
    itpEteId = (await db.iTP.create({ data: { userId, especeId: eteId, nom: 'ITP d’été fictif PR73', nbRangs: 3, espacementRangs: 25 } })).id
    itpSansEspeceId = (await db.iTP.create({ data: { userId, nom: 'ITP sans espèce fictif PR73', nbRangs: 3, espacementRangs: 25 } })).id
    plancheId = (await db.planche.create({ data: { userId, nom: 'Planche fictive PR73 création', largeur: 0.8, longueur: 20 } })).id
  })
  beforeEach(async () => {
    await db.culture.deleteMany({ where: { userId } })
    // L'annuelle de l'été, seule sur la planche : 0,50 m de 0,80 m.
    await db.culture.create({ data: {
      userId, especeId: eteId, itpId: itpEteId, plancheId, annee: 2027, longueur: 20, nbRangs: 3,
      dateSemis: jour('2027-06-01'), dateRecolte: jour('2027-08-01'),
    } })
  })
  afterAll(async () => {
    if (userId) await db.user.delete({ where: { id: userId } })
    await db.$disconnect()
  })

  const corps = (vivace: boolean) => ({
    especeId: vivace ? vivaceId : annuelleId, itpId: vivace ? itpVivaceId : itpAnnuelId, plancheId, annee: 2027,
    nbRangs: 3, longueur: 20, dateSemis: '2027-01-04', dateRecolte: '2027-02-01',
    semisFait: false, plantationFaite: false, recolteFaite: false,
  })
  const creer = (vivace: boolean) => POST(new NextRequest('http://localhost/api/cultures', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps(vivace)),
  }))
  const apercu = async (query: Record<string, string>) => {
    const res = await occupation(new NextRequest(`http://localhost/api/cultures/occupation?${new URLSearchParams(query)}`))
    expect(res.status).toBe(200)
    return res.json()
  }
  const requeteApercu = (itpId: string, extra: Record<string, string> = {}) => ({
    plancheId, itpId, nbRangs: '3', longueur: '20', dateSemis: '2027-01-04', dateRecolte: '2027-02-01', ...extra,
  })
  const ecrites = (especeId: string) => db.culture.count({ where: { userId, especeId, dateSemis: jour('2027-01-04') } })

  it('POST (sonde 1 de revue-adv-183) : une nouvelle vivace qui prendrait la place de l’annuelle de l’été renvoie 400 sans écriture', async () => {
    const res = await creer(true)
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toMatch(/largeur/i)
    expect(await ecrites(vivaceId)).toBe(0)
  })

  it('POST (témoin) : la même culture annuelle, terminée avant l’été, est créée', async () => {
    const res = await creer(false)
    expect(res.status).toBe(201)
    expect(await ecrites(annuelleId)).toBe(1)
  })

  it('creerCulturesBatch (sonde 2 de revue-adv-183) : la même vivace n’est pas créée, motif nommé, aucune écriture', async () => {
    const r = await creerCulturesBatch(userId, [{ plancheId, itpId: itpVivaceId, annee: 2027 }])
    expect(r.created).toBe(0)
    expect(r.ignorees).toHaveLength(1)
    expect(r.ignorees[0].motif).toMatch(/largeur/i)
    expect(await db.culture.count({ where: { userId, especeId: vivaceId } })).toBe(0)
  })

  it('creerCulturesBatch (témoin) : l’annuelle du même itinéraire de janvier est créée', async () => {
    const r = await creerCulturesBatch(userId, [{ plancheId, itpId: itpAnnuelId, annee: 2027 }])
    expect(r.created).toBe(1)
    expect(r.ignorees).toHaveLength(0)
  })

  it('aperçu de l’assistant : la vivace est évaluée vivace (espèce de l’ITP), l’annuelle reste possible', async () => {
    expect(await apercu(requeteApercu(itpVivaceId))).toMatchObject({ verifie: true, possible: false })
    expect(await apercu(requeteApercu(itpAnnuelId))).toMatchObject({ verifie: true, possible: true })
  })

  it('aperçu de l’assistant : l’espèce de l’ITP prime sur le paramètre especeId', async () => {
    expect(await apercu(requeteApercu(itpAnnuelId, { especeId: vivaceId }))).toMatchObject({ verifie: true, possible: true })
    expect(await apercu(requeteApercu(itpVivaceId, { especeId: annuelleId }))).toMatchObject({ verifie: true, possible: false })
  })

  it('aperçu de l’assistant : un ITP sans espèce prend la vivace du paramètre especeId, lue dans le compte', async () => {
    expect(await apercu(requeteApercu(itpSansEspeceId, { especeId: vivaceId }))).toMatchObject({ verifie: true, possible: false })
    expect(await apercu(requeteApercu(itpSansEspeceId, { especeId: annuelleId }))).toMatchObject({ verifie: true, possible: true })
    expect(await apercu(requeteApercu(itpSansEspeceId))).toMatchObject({ verifie: true, possible: true })
  })

  it('aperçu de l’assistant : la vivace privée d’une autre exploitation n’est pas lue', async () => {
    const autre = await db.user.create({ data: { email: `pr73-autre-${randomUUID()}@example.invalid`, emailVerified: true } })
    try {
      const privee = await db.espece.create({ data: { userId: autre.id, nom: 'Vivace privée fictive PR73', vivace: true } })
      expect(await apercu(requeteApercu(itpSansEspeceId, { especeId: privee.id }))).toMatchObject({ verifie: true, possible: true })
    } finally {
      await db.user.delete({ where: { id: autre.id } })
    }
  })
})
