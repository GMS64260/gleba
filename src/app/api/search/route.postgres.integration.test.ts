/** Prédicats et projections réels sur PostgreSQL, témoins inventés uniquement.
 * Authentification simulée : ne constitue pas une recette HTTP avec session.
 */
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeReferentielKey } from '@/lib/normalize'

const auth = vi.hoisted(() => ({ id: '', modulesExploitation: undefined as string[] | undefined }))
vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: auth } }),
}))
vi.mock('@/lib/abonnement/serveur', async () => {
  const { accesComplet } = await import('@/lib/abonnement/politique')
  return { chargerAccesService: async () => accesComplet('libre') }
})
vi.mock('@/lib/prisma', async () => {
  const { PrismaClient } = await import('@prisma/client')
  const testUrl = process.env.TEST_DATABASE_URL
  return { default: new PrismaClient(testUrl ? { datasources: { db: { url: testUrl } } } : undefined) }
})
import db from '@/lib/prisma'
import { GET, type SearchItem } from './route'

const url = process.env.TEST_DATABASE_URL

describe.runIf(!!url)('recherche B4/B5 — PostgreSQL gleba_tests', () => {
  const prefixe = `search-${randomUUID()}`
  const comptes = [`${prefixe}-a`, `${prefixe}-b`]
  const especes: string[] = []
  const varietes: string[] = []
  const cultures: number[] = []
  const recoltes: number[] = []
  const identifiants = (items: SearchItem[], type: string) => items.filter(i => i.type === type).map(i => i.id).sort()

  async function chercher(q: string) {
    const res = await GET(new NextRequest(`http://localhost/api/search?q=${encodeURIComponent(q)}`))
    expect(res.status).toBe(200)
    return (await res.json()).items as SearchItem[]
  }

  beforeAll(async () => {
    if (!url || new URL(url).pathname !== '/gleba_tests' || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
      throw new Error('Base locale jetable gleba_tests obligatoire')
    }
    await db.user.createMany({ data: comptes.map(id => ({ id, email: `${id}@example.invalid` })) })
    // Catalogue officiel, privé du compte, partagé, privé étranger.
    const noms = ['Épinard de printemps', 'Épinard d’hiver', 'Épinard officiel', 'Épinard réservé']
    for (let i = 0; i < noms.length; i++) {
      especes.push((await db.espece.create({ data: {
        id: `${prefixe}-e${i}`, nom: noms[i], nomNormalise: normalizeReferentielKey(noms[i]),
        userId: i === 2 ? null : comptes[i === 0 ? 0 : 1], partageCommunaute: i === 1,
      } })).id)
    }
    const nomsVariete = ['Épinard — Géant', 'Épinard partagé', 'Épinard officiel', 'Épinard confidentiel', 'Épinard interdit']
    for (let i = 0; i < nomsVariete.length; i++) {
      varietes.push((await db.variete.create({ data: {
        id: `${prefixe}-v${i}`, nom: nomsVariete[i], nomNormalise: normalizeReferentielKey(nomsVariete[i]),
        especeId: especes[i < 3 ? i : i === 3 ? 0 : 3],
        userId: i === 2 || i === 4 ? null : comptes[i === 0 ? 0 : 1], partageCommunaute: i === 1,
      } })).id)
    }
    for (let i = 0; i < 6; i++) {
      const especeId = especes[i < 3 ? i : i === 3 ? 3 : 0]
      const varieteId = i === 3 ? null : varietes[i < 3 ? i : i === 4 ? 3 : 4]
      const c = await db.culture.create({ data: { userId: comptes[0], especeId, varieteId, annee: 2026 } })
      cultures.push(c.id)
      if (i < 4) recoltes.push((await db.recolte.create({ data: { userId: comptes[0], cultureId: c.id, especeId, quantite: 2, notes: 'note littérale -- et 100% et a_b' } })).id)
    }
    // Les mêmes références visibles ne donnent aucun droit sur la production étrangère.
    const etrangere = await db.culture.create({ data: { userId: comptes[1], especeId: especes[0], varieteId: varietes[0] } })
    cultures.push(etrangere.id)
    recoltes.push((await db.recolte.create({ data: { userId: comptes[1], cultureId: etrangere.id, especeId: especes[0], quantite: 7 } })).id)
  }, 30000)

  beforeEach(() => {
    // Le tenant est dans session.user.id, distinct d'un éventuel acteur membre.
    Object.assign(auth, { id: comptes[0], modulesExploitation: undefined })
  })

  afterAll(async () => {
    if (url && new URL(url).pathname === '/gleba_tests' && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
      await db.recolte.deleteMany({ where: { userId: { in: comptes } } })
      await db.culture.deleteMany({ where: { userId: { in: comptes } } })
      await db.variete.deleteMany({ where: { id: { in: varietes } } })
      await db.espece.deleteMany({ where: { id: { in: especes } } })
      await db.user.deleteMany({ where: { id: { in: comptes } } })
    }
    await db.$disconnect()
  }, 30000)

  it('épinard/epinard/ÉPINARD rendent les mêmes ids autorisés sous les limites', async () => {
    const resultats = await Promise.all(['épinard', 'epinard', 'ÉPINARD'].map(chercher))
    for (const items of resultats) {
      expect(identifiants(items, 'Culture')).toEqual([0, 1, 2, 4, 5].map(i => `culture-${cultures[i]}`).sort())
      expect(identifiants(items, 'Récolte')).toEqual([0, 1, 2].map(i => `recolte-${recoltes[i]}`).sort())
      expect(identifiants(items, 'Variété')).toEqual(varietes.slice(0, 3).map(id => `variete-${id}`).sort())
      expect(JSON.stringify(items)).not.toMatch(/confidentiel|interdit|réservé/)
    }
  })

  it('cherche la culture par nom de variété et normalise tirets, underscores et casse', async () => {
    for (const q of ['Géant', 'epinard-geant', 'ÉPINARD_GÉANT']) {
      const items = await chercher(q)
      expect(identifiants(items, 'Culture')).toEqual([`culture-${cultures[0]}`])
      expect(identifiants(items, 'Variété')).toEqual([`variete-${varietes[0]}`])
    }
  })

  it('conserve les ids historiques et masque les noms devenus privés, même sur recherche par notes', async () => {
    expect(identifiants(await chercher(especes[0]), 'Culture')).toEqual([0, 4, 5].map(i => `culture-${cultures[i]}`).sort())
    expect(identifiants(await chercher(varietes[0]), 'Culture')).toEqual([`culture-${cultures[0]}`])
    for (const q of [especes[3], varietes[3], varietes[4], 'littérale']) {
      const items = await chercher(q)
      expect(items.length).toBeGreaterThan(0)
      expect(JSON.stringify(items)).not.toMatch(/confidentiel|interdit|réservé/)
    }
    for (const q of ['confidentiel', 'interdit', 'réservé']) expect(await chercher(q)).toEqual([])
  })

  it('le retrait du partage retire les correspondances par nom et le libellé', async () => {
    await db.espece.update({ where: { id: especes[1] }, data: { partageCommunaute: false } })
    try {
      expect(await chercher('hiver')).toEqual([])
      const items = await chercher(especes[1])
      expect(identifiants(items, 'Culture')).toEqual([`culture-${cultures[1]}`])
      expect(identifiants(items, 'Récolte')).toEqual([`recolte-${recoltes[1]}`])
      expect(JSON.stringify(items)).not.toMatch(/hiver|partagé/i)
      expect(identifiants(await chercher('partagé'), 'Variété')).toEqual([])
    } finally {
      await db.espece.update({ where: { id: especes[1] }, data: { partageCommunaute: true } })
    }
  })

  it('une clé vide et les jokers SQL restent littéraux sans élargir la recherche', async () => {
    for (const q of ['__', '%%', '— —']) expect(await chercher(q)).toEqual([])
    for (const q of ['--', '100%', 'a_b']) {
      const items = await chercher(q)
      expect(identifiants(items, 'Récolte')).toEqual(recoltes.slice(0, 4).map(id => `recolte-${id}`).sort())
      expect(identifiants(items, 'Culture')).toEqual([])
      expect(identifiants(items, 'Variété')).toEqual([])
    }
  })

  it('filtre toujours les modules fermés', async () => {
    auth.modulesExploitation = ['elevage']
    expect(await chercher('epinard')).toEqual([])
  })
})
