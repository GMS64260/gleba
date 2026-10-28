import { afterEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ choisir: vi.fn(), synchroniser: vi.fn(), planifier: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: { connexionStripe: { findFirst: mock.choisir } } }))
vi.mock('./stripe', () => ({ synchroniserStripe: mock.synchroniser }))
vi.mock('node-cron', () => ({ default: { schedule: mock.planifier } }))
afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('synchronisation périodique Stripe', () => {
  it('ne lance pas de tâche pendant une construction ni si elle est désactivée', async () => {
    const { initBanqueScheduler } = await import('./scheduler')
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    initBanqueScheduler()
    vi.stubEnv('NEXT_PHASE', '')
    vi.stubEnv('STRIPE_SYNC_ENABLED', 'false')
    initBanqueScheduler()
    expect(mock.planifier).not.toHaveBeenCalled()
    vi.stubEnv('STRIPE_SYNC_ENABLED', 'true')
    initBanqueScheduler()
    initBanqueScheduler()
    expect(mock.planifier).toHaveBeenCalledTimes(1)
  })
  it('traite un compte à la fois et poursuit la rotation entre les comptes', async () => {
    const { synchroniserProchaineConnexion } = await import('./scheduler')
    mock.choisir
      .mockResolvedValueOnce({ id: 'a', userId: 'u-a' })
      .mockResolvedValueOnce({ id: 'b', userId: 'u-b' })
    let terminer!: () => void
    mock.synchroniser
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            terminer = resolve
          }),
      )
      .mockResolvedValue(undefined)
    const premier = synchroniserProchaineConnexion()
    await vi.waitFor(() => expect(mock.synchroniser).toHaveBeenCalledTimes(1))
    await synchroniserProchaineConnexion()
    expect(mock.choisir).toHaveBeenCalledTimes(1)
    terminer()
    await premier
    await synchroniserProchaineConnexion()
    expect(mock.choisir.mock.calls[1][0].where.id).toEqual({ gt: 'a' })
    expect(mock.synchroniser.mock.calls[1]).toEqual(['u-b', 'b'])
  })
})
