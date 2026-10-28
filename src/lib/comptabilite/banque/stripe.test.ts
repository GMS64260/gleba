import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/prisma', () => ({ default: {} }))
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
import { centimesStripe, chiffrerJeton, dechiffrerJeton, verifierTransactionStripe } from './stripe'
afterEach(() => vi.unstubAllEnvs())
describe('accès et opérations Stripe', () => {
  it('chiffre les accès et refuse un jeton altéré ou une autre clé', () => {
    vi.stubEnv('STRIPE_TOKEN_ENCRYPTION_KEY', 'cle-de-test-sans-acces-'.repeat(3))
    const chiffre = chiffrerJeton('jeton-fictif')
    expect(chiffre).not.toContain('jeton-fictif')
    expect(dechiffrerJeton(chiffre)).toBe('jeton-fictif')
    expect(chiffrerJeton('jeton-fictif')).not.toBe(chiffre)
    expect(() =>
      dechiffrerJeton(chiffre.slice(0, -2) + (chiffre.endsWith('00') ? '01' : '00')),
    ).toThrow()
    vi.stubEnv('STRIPE_TOKEN_ENCRYPTION_KEY', 'autre-cle-de-test-sans-acces-'.repeat(3))
    expect(() => dechiffrerJeton(chiffre)).toThrow()
  })
  it('conserve le brut, les frais et le net', () => {
    expect(
      verifierTransactionStripe({
        id: 'txn_FAUX',
        amount: 10000,
        fee: 300,
        net: 9700,
        currency: 'eur',
        created: 1761580800,
        description: null,
        type: 'charge',
        status: 'available',
      }),
    ).toEqual({ brut: 10000, frais: 300, net: 9700 })
    expect(() =>
      verifierTransactionStripe({
        id: 'txn_FAUX',
        amount: 10000,
        fee: 300,
        net: 10000,
        currency: 'eur',
        created: 1761580800,
        description: null,
        type: 'charge',
        status: 'available',
      }),
    ).toThrow()
  })
  it('convertit les devises sans décimales et refuse une précision non prise en charge', () => {
    expect(centimesStripe(100, 'jpy')).toBe(10000)
    expect(centimesStripe(100, 'eur')).toBe(100)
    expect(() => centimesStripe(1000, 'tnd')).toThrow()
  })
})
