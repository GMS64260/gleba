import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findFirstOrThrow: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
}))
vi.mock('@/lib/prisma', () => {
  const connexionStripe = {
    updateMany: mocks.updateMany,
    findFirstOrThrow: mocks.findFirstOrThrow,
    count: mocks.count,
    findUnique: mocks.findUnique,
    upsert: mocks.upsert,
  }
  return {
    default: {
      connexionStripe,
      $transaction: (action: (db: object) => Promise<unknown>) => action({ connexionStripe }),
    },
  }
})
vi.mock('@/lib/kpi', () => ({ invalidateKpi: vi.fn() }))
vi.mock('@/lib/demo-garde', () => ({ estCompteDemo: async () => false }))
vi.mock('../reglements', () => ({ verrouillerReglements: vi.fn() }))
import {
  centimesStripe,
  chiffrerJeton,
  connecterCleStripe,
  dechiffrerJeton,
  ErreurJetonStripe,
  ErreurStripeActifAilleurs,
  erreurConnexionStripe,
  MESSAGE_STRIPE_ACTIF_AILLEURS,
  synchroniserStripe,
  verifierTransactionStripe,
} from './stripe'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
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

/**
 * Revue du 2026-10-29 : la clé de chiffrement retombe sur AUTH_SECRET ; une
 * rotation rendait les jetons illisibles et la synchronisation échouait en
 * silence (avertissement générique). L'échec est désormais explicite.
 */
describe('jeton Stripe devenu illisible', () => {
  it('met la connexion en erreur avec un message « reconnectez Stripe » et un journal sans secret', async () => {
    vi.stubEnv('STRIPE_TOKEN_ENCRYPTION_KEY', 'ancienne-cle-de-test-'.repeat(3))
    const jetonChiffre = chiffrerJeton('rk_test_jeton_entierement_fictif')
    vi.stubEnv('STRIPE_TOKEN_ENCRYPTION_KEY', 'nouvelle-cle-de-test-'.repeat(3))
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.findFirstOrThrow.mockResolvedValue({ id: 'cx-qa', userId: 'u1', jetonChiffre })
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    const appel = vi.fn()
    vi.stubGlobal('fetch', appel)

    const echec = synchroniserStripe('u1', 'cx-qa')
    await expect(echec).rejects.toBeInstanceOf(ErreurJetonStripe)
    await expect(echec).rejects.toThrow('Reconnectez Stripe')
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'cx-qa', userId: 'u1', verrouSynchroJusqua: expect.any(Date) },
      data: { actif: false },
    })
    const texte = journal.mock.calls.flat().join(' ')
    expect(texte).toContain('cx-qa')
    expect(texte).toContain('STRIPE_TOKEN_ENCRYPTION_KEY')
    expect(texte).not.toContain('rk_test_')
    expect(texte).not.toContain(jetonChiffre)
    expect(appel).not.toHaveBeenCalled()
    // L'écran Banque lit cet état : désactivée sans déconnexion volontaire.
    expect(erreurConnexionStripe({ actif: false, jetonChiffre })).toContain('Reconnectez Stripe')
    expect(erreurConnexionStripe({ actif: false, jetonChiffre: '' })).toBeNull()
    expect(erreurConnexionStripe({ actif: true, jetonChiffre })).toBeNull()
  })
  it('distingue une configuration absente d’un jeton à renouveler', () => {
    vi.stubEnv('STRIPE_TOKEN_ENCRYPTION_KEY', 'cle-de-test-sans-acces-'.repeat(3))
    const chiffre = chiffrerJeton('jeton-fictif')
    vi.stubEnv('STRIPE_TOKEN_ENCRYPTION_KEY', '')
    vi.stubEnv('AUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    expect(() => dechiffrerJeton(chiffre)).toThrow(expect.objectContaining({ status: 503 }))
    expect(() => dechiffrerJeton(chiffre)).not.toThrow(ErreurJetonStripe)
  })
})

/**
 * Revue du 2026-10-30 : l'unicité (compte Stripe, mode) était globale. Une
 * connexion déconnectée d'une exploitation bloquait le même compte ailleurs.
 * Désormais : une ligne par exploitation (upsert sur userId + compte + mode)
 * et une seule connexion active par compte sur l'instance.
 */
describe('connexion d’un compte Stripe déjà connu d’une autre exploitation', () => {
  const stripeFictif = () =>
    vi.fn(async (url: string) => {
      const chemin = new URL(url).pathname
      return Response.json(
        chemin === '/v1/account'
          ? { id: 'acct_QAPARTAGE' }
          : chemin === '/v1/balance'
            ? { available: [], pending: [] }
            : { data: [], has_more: false },
      )
    })
  const cle = { userId: 'u-b', compteStripeId: 'acct_QAPARTAGE', modeTest: true }
  const preparer = () => {
    vi.stubEnv('STRIPE_TOKEN_ENCRYPTION_KEY', 'cle-de-test-sans-acces-'.repeat(3))
    vi.stubGlobal('fetch', stripeFictif())
    mocks.findUnique.mockResolvedValue(null)
    mocks.upsert.mockImplementation(async ({ create }: { create: typeof cle }) => ({
      id: 'cx-b',
      ...create,
    }))
  }

  it('accepte un compte déconnecté ailleurs et enregistre par upsert sur la clé de l’exploitation', async () => {
    preparer()
    mocks.count.mockResolvedValue(0)

    const resultat = await connecterCleStripe('u-b', 'rk_test_cle_entierement_fictive')

    expect(resultat).toEqual({ id: 'cx-b', modeTest: true, actif: true })
    // Seule une connexion ACTIVE d'une AUTRE exploitation compte.
    expect(mocks.count).toHaveBeenCalledWith({
      where: { compteStripeId: 'acct_QAPARTAGE', modeTest: true, actif: true, userId: { not: 'u-b' } },
    })
    const [args] = mocks.upsert.mock.calls[0]
    expect(args.where).toEqual({ userId_compteStripeId_modeTest: cle })
    expect(args.create).toMatchObject({ ...cle, actif: true })
    expect(args.update).toEqual({ jetonChiffre: expect.any(String), actif: true })
    expect(args.update.jetonChiffre).not.toContain('rk_test_')
  })

  it('refuse en 409, avec un message clair, un compte actif dans une autre exploitation', async () => {
    preparer()
    mocks.count.mockResolvedValue(1)

    const refus = connecterCleStripe('u-b', 'rk_test_cle_entierement_fictive')

    await expect(refus).rejects.toMatchObject({ status: 409, message: MESSAGE_STRIPE_ACTIF_AILLEURS })
    await expect(refus).rejects.toBeInstanceOf(ErreurStripeActifAilleurs)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('traduit en même refus 409 la course perdue contre l’index partiel des connexions actives', async () => {
    preparer()
    mocks.count.mockResolvedValue(0)
    mocks.upsert.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    )

    await expect(
      connecterCleStripe('u-b', 'rk_test_cle_entierement_fictive'),
    ).rejects.toBeInstanceOf(ErreurStripeActifAilleurs)
  })

  it('renouvelle la connexion de la même exploitation sans la refuser', async () => {
    preparer()
    mocks.count.mockResolvedValue(0)
    mocks.findUnique.mockResolvedValue({ verrouSynchroJusqua: null })

    await expect(connecterCleStripe('u-b', 'rk_test_cle_entierement_fictive')).resolves.toMatchObject({
      actif: true,
    })
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { userId_compteStripeId_modeTest: cle },
      select: { verrouSynchroJusqua: true },
    })
  })
})
