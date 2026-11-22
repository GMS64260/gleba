/**
 * Déconnexion depuis le menu : les tâches de tournée cochées sans réseau ne sont
 * plus effacées sans prévenir.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  envoyer: vi.fn(), purger: vi.fn(), signOut: vi.fn(), confirmer: vi.fn(), alerter: vi.fn(),
}))
vi.mock('next-auth/react', () => ({ signOut: mocks.signOut }))
vi.mock('@/lib/elevage/offline-tournee', () => ({ envoyerFileAvantDeconnexion: mocks.envoyer, purgerCacheTournee: mocks.purger }))
vi.mock('@/lib/global-dialog', () => ({ confirmDialog: mocks.confirmer, alertDialog: mocks.alerter }))

import { avantDeconnexionTournee, seDeconnecter } from './deconnexion'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.purger.mockResolvedValue(undefined)
  mocks.alerter.mockResolvedValue(undefined)
})

describe('avantDeconnexionTournee', () => {
  it('file vide ou envoyée : la déconnexion suit, sans dialogue', async () => {
    mocks.envoyer.mockResolvedValue({ restantes: 0, cause: null })
    expect(await avantDeconnexionTournee()).toBe(true)
    expect(mocks.confirmer).not.toHaveBeenCalled()
    expect(mocks.alerter).not.toHaveBeenCalled()
  })

  it('sans réseau : la déconnexion est retenue, rien n’est proposé qui effacerait la file', async () => {
    mocks.envoyer.mockResolvedValue({ restantes: 3, cause: 'reseau' })
    expect(await avantDeconnexionTournee()).toBe(false)
    expect(mocks.confirmer).not.toHaveBeenCalled()
    expect(mocks.alerter.mock.calls[0][0]).toContain('3 tâches de tournée')
  })

  it('refus du serveur : la personne choisit de rester ou de partir', async () => {
    mocks.envoyer.mockResolvedValue({ restantes: 1, cause: 'refus' })
    mocks.confirmer.mockResolvedValueOnce(false)
    expect(await avantDeconnexionTournee()).toBe(false)
    mocks.confirmer.mockResolvedValueOnce(true)
    expect(await avantDeconnexionTournee()).toBe(true)
    expect(mocks.confirmer.mock.calls[0][0]).toContain('Une tâche de tournée')
  })
})

describe('seDeconnecter', () => {
  it('purge le cache de la tournée avant de fermer la session', async () => {
    const ordre: string[] = []
    mocks.purger.mockImplementation(async () => { ordre.push('purge') })
    mocks.signOut.mockImplementation(async () => { ordre.push('signOut') })
    await seDeconnecter({ callbackUrl: '/login' })
    expect(ordre).toEqual(['purge', 'signOut'])
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })
})
