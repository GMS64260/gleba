/**
 * Revue du 2026-10-30 : par OAuth, le refus « compte Stripe actif dans une
 * autre exploitation » finissait en `connexion=echec`, message générique. Il
 * revient désormais en `connexion=deja-active`, que l'écran Banque explique.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), terminer: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/comptabilite/banque/stripe-oauth', async (original) => ({
  ...(await original<typeof import('@/lib/comptabilite/banque/stripe-oauth')>()),
  terminerConnexionStripe: mocks.terminer,
}))
import { GET } from './route'
import { ErreurStripeActifAilleurs } from '@/lib/comptabilite/banque/stripe'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'

const retour = () =>
  GET(
    new NextRequest(
      'https://gleba.test/api/comptabilite/banque/stripe/retour?state=etat&code=ac_fictif',
    ),
  )

beforeEach(() => {
  vi.stubEnv('NEXTAUTH_URL', 'https://gleba.test')
  mocks.auth.mockResolvedValue({
    error: null,
    session: {
      user: {
        id: 'u1',
        acteurId: 'u1',
        estProprietaireExploitation: true,
        peutEcrireExploitation: true,
      },
    },
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('retour OAuth Stripe', () => {
  it('signale un compte déjà actif dans une autre exploitation par une valeur dédiée', async () => {
    mocks.terminer.mockRejectedValue(new ErreurStripeActifAilleurs())

    const reponse = await retour()

    expect(reponse.status).toBe(307)
    expect(reponse.headers.get('location')).toBe(
      'https://gleba.test/comptabilite/banque?connexion=deja-active',
    )
    expect(mocks.terminer).toHaveBeenCalledWith('u1', 'u1', 'etat', 'ac_fictif')
  })

  it('garde l’échec générique pour les autres erreurs, même en 409', async () => {
    mocks.terminer.mockRejectedValue(new ErreurReglement('Cette connexion a expiré.'))

    const reponse = await retour()

    expect(reponse.headers.get('location')).toBe(
      'https://gleba.test/comptabilite/banque?connexion=echec',
    )
  })

  it('confirme une connexion réussie', async () => {
    mocks.terminer.mockResolvedValue({ id: 'cx', modeTest: true, actif: true })

    const reponse = await retour()

    expect(reponse.headers.get('location')).toBe(
      'https://gleba.test/comptabilite/banque?connexion=connecte',
    )
  })
})
