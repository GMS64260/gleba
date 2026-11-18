/**
 * PostgreSQL réel, données fictives ; l'authentification est simulée (aucune
 * preuve de garde HTTP ici).
 *
 * Décision du 2026-11-15 (PR #73) : une règle d'association n'est plus
 * supprimée mais désactivée. Elle garde ses détails et son historique, n'alerte
 * plus, n'est plus listée, et se réactive par PUT { active: true }.
 *
 * Second bloc : sur une base peuplée puis migrée (script de preuve du lot,
 * base jetable `gleba_jetable_*`), les trois règles du référentiel sont
 * désactivées avec tous leurs détails et « Romarin ! » se réactive.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import type { User } from '@prisma/client'
const auth = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: auth.userId } } }),
  requireAdminApi: async () => ({ error: null, session: { user: { id: auth.userId } } }),
}))
import db from '@/lib/prisma'
import { GET } from './route'
import { PUT } from './[id]/route'
import { alertesAssociations } from '@/lib/associations-alertes'

const baseAutorisee = () => {
  const nom = new URL(process.env.DATABASE_URL || '').pathname
  return (nom === '/gleba_tests' && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL)
    || nom.startsWith('/gleba_jetable_')
}
const put = (id: string, body: object) => PUT(
  new NextRequest(`http://localhost/api/associations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  { params: Promise.resolve({ id }) })

describe.skipIf(process.env.GLEBA_PR73_POSTGRES !== '1')('associations désactivées : conservées, exclues, réactivables', () => {
  let user: User
  const suffixe = randomUUID().slice(0, 8)
  const pivot = `Pivot fictif PR73 ${suffixe}`
  const partenaire = `Partenaire fictif PR73 ${suffixe}`
  const associationId = `asso-pr73-desactivation-${suffixe}`

  beforeAll(async () => {
    if (!baseAutorisee()) throw new Error('Base gleba_tests ou gleba_jetable_* obligatoire')
    user = await db.user.create({ data: { email: `pr73-associations-${randomUUID()}@example.invalid`, emailVerified: true } })
    auth.userId = user.id
    await db.espece.createMany({ data: [{ id: pivot, nom: pivot }, { id: partenaire, nom: partenaire }] })
    await db.association.create({ data: { id: associationId, nom: `Règle fictive PR73 ${suffixe}`, type: 'incompatible',
      details: { create: [{ especeId: pivot, requise: true }, { especeId: partenaire, requise: false }] } } })
  })
  afterAll(async () => {
    await db.association.deleteMany({ where: { id: associationId } })
    await db.espece.deleteMany({ where: { id: { in: [pivot, partenaire] } } })
    if (user) await db.user.delete({ where: { id: user.id } })
    await db.$disconnect()
  })

  const alertes = () => alertesAssociations(db, [pivot, partenaire], user.id)
  const liste = async () => {
    const res = await GET(new NextRequest(`http://localhost/api/associations?especeId=${encodeURIComponent(pivot)}`))
    return ((await res.json()) as { id: string }[]).map((a) => a.id)
  }
  const details = async () => (await db.associationDetail.findMany({ where: { associationId }, orderBy: { id: 'asc' } }))
    .map((d) => ({ id: d.id, especeId: d.especeId, requise: d.requise }))

  it('désactivée : détails conservés, plus d’alerte ni de liste ; réactivée : tout revient', async () => {
    const lignes = await details()
    expect(lignes).toHaveLength(2)
    expect((await alertes()).length).toBeGreaterThan(0)
    expect(await liste()).toContain(associationId)

    const desactivation = await put(associationId, { active: false, motifDesactivation: 'Motif fictif PR73' })
    expect(desactivation.status).toBe(200)
    const desactivee = await db.association.findUniqueOrThrow({ where: { id: associationId } })
    expect(desactivee.desactiveeLe).toBeInstanceOf(Date)
    expect(desactivee.motifDesactivation).toBe('Motif fictif PR73')
    expect(await details()).toEqual(lignes)
    expect(await alertes()).toEqual([])
    expect(await liste()).not.toContain(associationId)

    // Désactiver de nouveau garde la date d'origine.
    expect((await put(associationId, { active: false })).status).toBe(200)
    expect((await db.association.findUniqueOrThrow({ where: { id: associationId } })).desactiveeLe)
      .toEqual(desactivee.desactiveeLe)

    const reactivation = await put(associationId, { active: true })
    expect(reactivation.status).toBe(200)
    const reactivee = await db.association.findUniqueOrThrow({ where: { id: associationId } })
    expect(reactivee.desactiveeLe).toBeNull()
    expect(reactivee.motifDesactivation).toBeNull()
    expect(await details()).toEqual(lignes)
    expect((await alertes()).length).toBeGreaterThan(0)
    expect(await liste()).toContain(associationId)
  })
})

const REFERENTIEL = {
  'cml1gbd2q00422vbmgnu2yzu8': 6, // Romarin !
  'cml1gbcxi003o2vbmhxl2zvnm': 2, // Poivron piment !
  'cml1gbbum00032vbm1wd9zeyz': 6, // Ail !
}

describe.skipIf(process.env.GLEBA_PR73_REFERENTIEL_PEUPLE !== '1')('base peuplée puis migrée : les trois règles du référentiel', () => {
  beforeAll(() => {
    if (!new URL(process.env.DATABASE_URL || '').pathname.startsWith('/gleba_jetable_')) {
      throw new Error('Base jetable gleba_jetable_* obligatoire')
    }
  })
  afterAll(async () => { await db.$disconnect() })

  it('sont désactivées avec tous leurs détails, et « Romarin ! » se réactive puis se désactive', async () => {
    const regles = await db.association.findMany({ where: { id: { in: Object.keys(REFERENTIEL) } },
      include: { _count: { select: { details: true } } } })
    expect(Object.fromEntries(regles.map((r) => [r.id, r._count.details]))).toEqual(REFERENTIEL)
    for (const r of regles) {
      expect(r.desactiveeLe).toBeInstanceOf(Date)
      expect(r.motifDesactivation).toMatch(/désactivée/)
    }

    const romarin = 'cml1gbd2q00422vbmgnu2yzu8'
    expect((await put(romarin, { active: true })).status).toBe(200)
    const reactivee = await db.association.findUniqueOrThrow({ where: { id: romarin }, include: { _count: { select: { details: true } } } })
    expect(reactivee.desactiveeLe).toBeNull()
    expect(reactivee._count.details).toBe(6)

    expect((await put(romarin, { active: false, motifDesactivation: 'Retour à l’état de la décision du 2026-11-15' })).status).toBe(200)
    const redesactivee = await db.association.findUniqueOrThrow({ where: { id: romarin }, include: { _count: { select: { details: true } } } })
    expect(redesactivee.desactiveeLe).toBeInstanceOf(Date)
    expect(redesactivee._count.details).toBe(6)
  })
})
