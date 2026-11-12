/**
 * SEC-04 (revue Codex du 2026-11-12) : les routes d'administration
 * reconnaissent l'administrateur par la PERSONNE connectée (acteur), pas par
 * l'exploitation qu'elle visite.
 *
 * Après `requireAdminApi`, `session.user.id` est le tenant (propriétaire de
 * l'exploitation affichée) et `session.user.acteurId` la personne. Un
 * administrateur membre d'une autre ferme pouvait se désactiver, se retirer
 * ses droits ou se supprimer, et recevait un faux « soi-même » sur le
 * propriétaire de la ferme visitée. La consultation (impersonation) était
 * aussi attribuée au propriétaire.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  grantCreate: vi.fn(),
}))

// Administrateur « admin-1 » qui visite la ferme de « proprio-1 », dont il est membre.
vi.mock('@/lib/auth-utils', () => ({
  requireAdminApi: async () => ({
    error: null,
    session: { user: { id: 'proprio-1', acteurId: 'admin-1', role: 'ADMIN', email: 'admin@example.com' } },
  }),
  hashPassword: async (p: string) => `hash:${p}`,
}))
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: m.userFindUnique, update: m.userUpdate },
    impersonationGrant: { create: m.grantCreate },
  },
}))
vi.mock('@/lib/abonnement/stripe', () => ({ arreterAvantSuppression: vi.fn() }))
vi.mock('@/lib/account-lifecycle', () => ({
  COMMUNAUTE_USER_ID: 'communaute',
  reprendreReferentielCommunaute: vi.fn(),
  supprimerDonneesSansCleEtrangere: vi.fn(),
  supprimerFichiersUtilisateur: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({ getClientIP: () => '127.0.0.1', checkRateLimit: () => null }))
vi.mock('@/lib/impersonation', () => ({
  genererJetonImpersonation: () => 'jeton',
  hashJeton: async () => 'hash-jeton',
  IMPERSONATION_TTL_MS: 60_000,
}))

import { DELETE, PATCH } from './route'
import { POST as impersonate } from '../../impersonate/route'

const patch = (id: string, corps: object) =>
  PATCH(new NextRequest(`http://local.test/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps),
  }), { params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  m.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id, email: `${where.id}@example.com`, name: null, role: where.id === 'admin-1' ? 'ADMIN' : 'USER', active: true,
  }))
  m.userUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: object }) => ({ id: where.id, ...data }))
  m.grantCreate.mockResolvedValue({ id: 'g1' })
})

describe('SEC-04 : « soi-même » désigne l’acteur, pas l’exploitation visitée', () => {
  it('l’administrateur ne peut pas se désactiver lui-même', async () => {
    const res = await patch('admin-1', { active: false })
    expect(res.status).toBe(400)
    expect(m.userUpdate).not.toHaveBeenCalled()
  })

  it('l’administrateur ne peut pas se retirer ses droits', async () => {
    const res = await patch('admin-1', { role: 'USER' })
    expect(res.status).toBe(400)
    expect(m.userUpdate).not.toHaveBeenCalled()
  })

  it('l’administrateur ne peut pas se supprimer lui-même', async () => {
    const res = await DELETE(new NextRequest('http://local.test/api/admin/users/admin-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'admin-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('le propriétaire de la ferme visitée n’est pas un faux « soi-même »', async () => {
    const res = await patch('proprio-1', { active: false })
    expect(res.status).toBe(200)
    expect(m.userUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'proprio-1' }, data: { active: false } }))
  })

  it('la consultation est attribuée à l’administrateur, pas au propriétaire visité', async () => {
    const res = await impersonate(new Request('http://local.test/api/admin/impersonate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'cible-1' }),
    }))
    expect(res.status).toBe(200)
    expect(m.grantCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ adminId: 'admin-1', targetId: 'cible-1' }) })
  })
})
