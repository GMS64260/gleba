/**
 * Revue du 2026-10-29 : la déconnexion effaçait le jeton localement sans
 * révoquer l'accès OAuth `read_write` chez Stripe. Une connexion OAuth est
 * désormais révoquée ; un échec n'empêche pas la déconnexion locale mais
 * revient en avertissement. Une clé restreinte se révoque dans le tableau de
 * bord Stripe : le message y invite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), updateMany: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: { connexionStripe: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
import { chiffrerJeton } from './stripe'
import { deconnecterStripe } from './stripe-oauth'

const connexion = (jeton: string) => ({ compteStripeId: 'acct_QA123', jetonChiffre: chiffrerJeton(jeton) })
const reponse = (status: number, corps: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corps }) as Response

beforeEach(() => {
  vi.stubEnv('STRIPE_TOKEN_ENCRYPTION_KEY', 'cle-de-test-sans-acces-'.repeat(3))
  vi.stubEnv('STRIPE_CONNECT_CLIENT_ID', 'ca_QAPLATEFORME')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_plateforme_fictive')
  vi.stubGlobal('fetch', mocks.fetch)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.updateMany.mockResolvedValue({ count: 1 })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('déconnexion Stripe', () => {
  it('révoque l’autorisation OAuth chez Stripe avec la clé secrète de la plateforme', async () => {
    mocks.findFirst.mockResolvedValue(connexion('sk_test_jeton_oauth_fictif'))
    mocks.fetch.mockResolvedValue(reponse(200, { stripe_user_id: 'acct_QA123' }))

    const resultat = await deconnecterStripe('u1', 'cx-qa')

    expect(resultat.avertissement).toBeUndefined()
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'cx-qa', userId: 'u1' }), data: { actif: false, jetonChiffre: '' } }),
    )
    const [url, options] = mocks.fetch.mock.calls[0]
    expect(url).toBe('https://connect.stripe.com/oauth/deauthorize')
    expect(options).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer sk_test_plateforme_fictive' } })
    expect(Object.fromEntries(new URLSearchParams(String(options.body)))).toEqual({
      client_id: 'ca_QAPLATEFORME',
      stripe_user_id: 'acct_QA123',
    })
  })

  it.each([
    ['refus', () => mocks.fetch.mockResolvedValue(reponse(500, {}))],
    ['panne réseau', () => mocks.fetch.mockRejectedValue(new TypeError('fetch failed'))],
  ])('déconnecte quand même localement et avertit en cas de %s', async (_cas, simuler) => {
    mocks.findFirst.mockResolvedValue(connexion('sk_test_jeton_oauth_fictif'))
    simuler()

    const resultat = await deconnecterStripe('u1', 'cx-qa')

    expect(mocks.updateMany).toHaveBeenCalled()
    expect(resultat.avertissement).toMatch(/tableau de bord Stripe/)
  })

  it('invite à révoquer une clé restreinte dans Stripe, sans appel à Stripe', async () => {
    mocks.findFirst.mockResolvedValue(connexion('rk_test_cle_restreinte_fictive'))

    const resultat = await deconnecterStripe('u1', 'cx-qa')

    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.updateMany).toHaveBeenCalled()
    expect(resultat.message).toMatch(/Révoquez aussi la clé restreinte dans votre tableau de bord Stripe/)
  })

  it('ne révoque rien pendant une synchronisation en cours', async () => {
    mocks.findFirst.mockResolvedValue(connexion('sk_test_jeton_oauth_fictif'))
    mocks.updateMany.mockResolvedValue({ count: 0 })

    await expect(deconnecterStripe('u1', 'cx-qa')).rejects.toMatchObject({ status: 409 })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})
