/** Filtrage PostgreSQL réel, données inventées ; session simulée, sans preuve HTTP d'autorisation. */
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const contexte = vi.hoisted(() => ({ db: undefined as unknown, userId: '' }))
vi.mock('@/lib/prisma', () => ({ get default() { return contexte.db } }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: contexte.userId } } }),
}))
import { GET } from './route'

describe.runIf(!!process.env.TEST_DATABASE_URL)('GET /api/jardin — année choisie sur PostgreSQL', () => {
  const prefixe = `jardin-annee-${randomUUID()}`
  const comptes = [`${prefixe}-a`, `${prefixe}-b`]
  const annuelle = `${prefixe}-annuelle`
  const vivace = `${prefixe}-vivace`
  const planches = [`${prefixe}-planche-a`, `${prefixe}-planche-b`]
  const parcelles = [`${prefixe}-parcelle-a`, `${prefixe}-parcelle-b`]
  const sansParcelle = `${prefixe}-sans-parcelle`
  const annee = new Date().getFullYear()
  let db: PrismaClient
  let cultureCourante: number
  let cultureFuture: number
  let cultureVivace: number

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || new URL(url).pathname !== '/gleba_tests' || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
      throw new Error('Base locale jetable gleba_tests obligatoire')
    }
    db = new PrismaClient({ datasources: { db: { url } } })
    contexte.db = db
    contexte.userId = comptes[0]
    await db.user.createMany({ data: comptes.map(id => ({ id, email: `${id}@example.invalid` })) })
    await db.espece.createMany({ data: [{ id: annuelle, nom: 'Annuelle fictive' }, { id: vivace, nom: 'Vivace fictive', vivace: true }] })
    await db.parcelleGeo.createMany({ data: parcelles.map((id, i) => ({
      id, nom: `Parcelle fictive ${i}`, userId: comptes[i], geometry: '{"type":"Polygon","coordinates":[]}',
    })) })
    await db.planche.createMany({ data: planches.map((id, i) => ({ id, nom: `Planche fictive ${i}`, userId: comptes[i], parcelleGeoId: parcelles[i] })) })
    await db.planche.create({ data: { id: sansParcelle, nom: 'Sans parcelle', userId: comptes[0] } })
    const creer = (annee: number, especeId = annuelle, terminee: string | null = null) => db.culture.create({
      data: { userId: comptes[0], plancheId: planches[0], especeId, annee, terminee },
    })
    cultureCourante = (await creer(annee)).id
    cultureFuture = (await creer(annee + 1)).id
    cultureVivace = (await creer(annee - 3, vivace)).id
    await creer(annee + 1, annuelle, 'oui')
    await creer(annee - 3, vivace, 'oui')
    await db.culture.create({ data: { userId: comptes[1], plancheId: planches[1], especeId: annuelle, annee: annee + 1 } })
  }, 30000)

  afterAll(async () => {
    if (!db) return
    await db.culture.deleteMany({ where: { userId: { in: comptes } } })
    await db.planche.deleteMany({ where: { userId: { in: comptes } } })
    await db.parcelleGeo.deleteMany({ where: { userId: { in: comptes } } })
    await db.espece.deleteMany({ where: { id: { in: [annuelle, vivace] } } })
    await db.user.deleteMany({ where: { id: { in: comptes } } })
    await db.$disconnect()
  }, 30000)

  async function lire(requete = '') {
    const res = await GET(new NextRequest(`http://localhost/api/jardin${requete}`))
    expect(res.status).toBe(200)
    return await res.json() as { id: string; cultures: { id: number; espece: { vivace: boolean } }[] }[]
  }

  it('affiche N+1 seulement sur N+1 et garde les vivaces non terminées', async () => {
    const courant = await lire(`?annee=${annee}`)
    const futur = await lire(`?annee=${annee + 1}`)
    expect(courant[0].cultures.map(c => c.id).sort()).toEqual([cultureCourante, cultureVivace].sort())
    expect(futur[0].cultures.map(c => c.id).sort()).toEqual([cultureFuture, cultureVivace].sort())
    expect(futur[0].cultures.find(c => c.id === cultureVivace)?.espece.vivace).toBe(true)
    expect(await lire()).toEqual(courant)
  })

  it('combine année, filtres parcelle et isolation entre deux tenants', async () => {
    expect((await lire(`?annee=${annee + 1}&parcelle=all`)).map(p => p.id)).toEqual([planches[0], sansParcelle])
    expect((await lire(`?annee=${annee + 1}&parcelle=none`)).map(p => p.id)).toEqual([sansParcelle])
    const selection = await lire(`?annee=${annee + 1}&parcelle=${parcelles[0]}`)
    expect(selection.map(p => p.id)).toEqual([planches[0]])
    expect(selection[0].cultures.map(c => c.id)).toContain(cultureFuture)
    expect(await lire(`?annee=${annee + 1}&parcelle=${parcelles[1]}`)).toEqual([])
    contexte.userId = comptes[1]
    try {
      const autre = await lire(`?annee=${annee + 1}`)
      expect(autre.map(p => p.id)).toEqual([planches[1]])
      expect(autre[0].cultures).toHaveLength(1)
      expect(autre[0].cultures.map(c => c.id)).not.toContain(cultureFuture)
    } finally {
      contexte.userId = comptes[0]
    }
  })
})
