/**
 * DELETE /api/elevage/naissances — la saillie liée (revue Codex ELEV-04, 2026-11-12).
 *
 * Le POST passe la saillie en « Mise-bas réalisée » ; la suppression de la
 * naissance la laissait ainsi. La saillie sans mise-bas sortait des gestantes et
 * des alertes de mise-bas, et faussait les indicateurs de reproduction, alors que
 * le PATCH des saillies refuse justement ce statut sans naissance enregistrée.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type Saillie = { id: string; userId: string; statut: string; confirmationGestation: Date | null }

const etat = vi.hoisted(() => ({
  naissance: null as null | Record<string, unknown>,
  naissanceSupprimee: false,
  saillies: [] as Saillie[],
}))

vi.mock('@/lib/auth-utils', () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: 'user-1' } } }),
}))
vi.mock('@/lib/prisma', () => {
  const trouver = (where: { id?: string; userId?: string }) =>
    etat.saillies.find((s) => (where.id === undefined || s.id === where.id) && (where.userId === undefined || s.userId === where.userId))
  const db = {
    $queryRaw: async () => [],
    naissanceAnimale: {
      findFirst: async ({ where }: { where: { id: number; userId: string } }) =>
        etat.naissance && etat.naissance.id === where.id && etat.naissance.userId === where.userId ? { ...etat.naissance, mere: null } : null,
      delete: async () => { etat.naissanceSupprimee = true; return etat.naissance },
    },
    petitNaissance: { count: async () => 0 },
    lotAnimaux: { findFirst: async () => null, update: async () => ({}) },
    saillie: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => trouver(where) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Saillie> }) => Object.assign(trouver(where)!, data),
      updateMany: async ({ where, data }: { where: { id: string; userId?: string; statut?: string }; data: Partial<Saillie> }) => {
        const s = trouver(where)
        if (!s || (where.statut !== undefined && s.statut !== where.statut)) return { count: 0 }
        Object.assign(s, data)
        return { count: 1 }
      },
    },
  }
  return { default: { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) } }
})

import { DELETE } from './route'

const supprimer = (id = 7) => DELETE(new NextRequest(`http://localhost/api/elevage/naissances?id=${id}`, { method: 'DELETE' }))

beforeEach(() => {
  etat.naissanceSupprimee = false
  etat.naissance = { id: 7, userId: 'user-1', lotId: null, nombreVivants: 2, saillieId: 'saillie-1' }
  etat.saillies = [{ id: 'saillie-1', userId: 'user-1', statut: 'Mise-bas réalisée', confirmationGestation: new Date('2026-06-01T00:00:00Z') }]
})

describe('DELETE /api/elevage/naissances — saillie liée', () => {
  it('rend la saillie gestante quand la gestation avait été confirmée', async () => {
    const res = await supprimer()
    expect(res.status).toBe(200)
    expect(etat.naissanceSupprimee).toBe(true)
    expect(etat.saillies[0].statut).toBe('Gestante')
  })

  it('remet « En attente » une saillie sans diagnostic de gestation', async () => {
    etat.saillies[0].confirmationGestation = null
    await supprimer()
    expect(etat.saillies[0].statut).toBe('En attente')
  })

  it('ne touche pas une saillie dont le statut a déjà changé', async () => {
    etat.saillies[0].statut = 'Avortement'
    await supprimer()
    expect(etat.saillies[0].statut).toBe('Avortement')
  })

  it('ne touche aucune saillie quand la naissance n’en avait pas', async () => {
    etat.naissance = { ...etat.naissance, saillieId: null }
    await supprimer()
    expect(etat.saillies[0].statut).toBe('Mise-bas réalisée')
  })
})
