// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ParametresPage from './page'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('rubrique=securite') }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('@/components/shell/AppHeader', () => ({ AppHeader: () => null }))
vi.mock('@/components/abonnement/AbonnementSection', () => ({ AbonnementSection: () => null }))
vi.mock('@/components/meteo', () => ({ StationMeteoConfig: () => null }))
vi.mock('@/hooks/use-modules', () => ({ useModules: () => ({ modules: [], save: vi.fn(), loading: false, isActif: () => false }) }))
vi.mock('@/hooks/use-elevage-modes', () => ({ useElevageModes: () => ({ modes: [], save: vi.fn(), loading: false }) }))
vi.mock('@/hooks/use-is-demo', () => ({ useIsDemoAccount: () => false }))

// Dialog, son portail, son piège de focus et sa croix sont les vrais composants Radix.
const fetchMock = vi.fn<typeof fetch>()
let hasPassword: boolean | null

beforeEach(() => {
  hasPassword = true
  window.history.replaceState(null, '', '/parametres?rubrique=securite')
  Element.prototype.scrollIntoView = vi.fn()
  fetchMock.mockReset().mockImplementation(async (url, init) => {
    if (init?.method && init.method !== 'GET') throw new Error('Mutation inattendue pendant une annulation')
    if (url === '/api/account') {
      return hasPassword === null ? Response.json({}, { status: 503 }) : Response.json({ hasPassword })
    }
    return Response.json({})
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')).toEqual([])
})

const dialogues = [
  { bouton: 'Tout supprimer', titre: 'Supprimer toutes vos données ?', annuler: 'Conserver mes données', confirmer: 'Supprimer définitivement', compte: false },
  { bouton: 'Supprimer mon compte', titre: 'Supprimer définitivement votre compte ?', annuler: 'Conserver mon compte', confirmer: 'Supprimer mon compte', compte: true },
] as const
type Dialogue = typeof dialogues[number]
type Fermeture = 'annuler' | 'Échap' | 'croix'
const fermetures: Fermeture[] = ['annuler', 'Échap', 'croix']

async function ouvrir(configuration: Dialogue) {
  const bouton = screen.getByRole('button', { name: configuration.bouton })
  bouton.focus()
  fireEvent.click(bouton)
  const dialogue = await screen.findByRole('dialog', { name: configuration.titre })
  const champs = within(dialogue)
  const confirmation = champs.getByLabelText('Tapez SUPPRIMER pour confirmer') as HTMLInputElement
  const valider = champs.getByRole('button', { name: configuration.confirmer }) as HTMLButtonElement
  await waitFor(() => expect(document.activeElement).toBe(confirmation))
  expect(confirmation.value).toBe('')
  expect(valider.disabled).toBe(true)
  if (configuration.compte && hasPassword !== false) {
    expect((champs.getByLabelText('Votre mot de passe') as HTMLInputElement).value).toBe('')
  }
  return { bouton, dialogue, champs, confirmation, valider }
}

async function fermer(configuration: Dialogue, ouverture: Awaited<ReturnType<typeof ouvrir>>, voie: Fermeture) {
  const { bouton, dialogue, champs } = ouverture
  if (voie === 'Échap') fireEvent.keyDown(document.activeElement ?? dialogue, { key: 'Escape', code: 'Escape' })
  else fireEvent.click(champs.getByRole('button', { name: voie === 'annuler' ? configuration.annuler : 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(bouton))
}

describe.each(dialogues)('Paramètres : retour du focus depuis $bouton', (configuration) => {
  it.each(fermetures)('%s ferme le dialogue, rend le focus et réinitialise les confirmations à la réouverture', async (voie) => {
    render(createElement(ParametresPage))
    const ouverture = await ouvrir(configuration)
    fireEvent.change(ouverture.confirmation, { target: { value: 'supprimer' } })
    expect(ouverture.valider.disabled).toBe(true)
    fireEvent.change(ouverture.confirmation, { target: { value: 'SUPPRIMER' } })
    if (configuration.compte) {
      await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/account')).toBe(true))
      expect(ouverture.valider.disabled).toBe(true)
      fireEvent.change(ouverture.champs.getByLabelText('Votre mot de passe'), { target: { value: 'mot-de-passe-fictif' } })
    }
    expect(ouverture.valider.disabled).toBe(false)
    await fermer(configuration, ouverture, voie)
    await fermer(configuration, await ouvrir(configuration), voie)
  })
})

describe('Paramètres : indépendance des dialogues de suppression', () => {
  it('rend le focus à chaque déclencheur après six alternances entre données et compte', async () => {
    render(createElement(ParametresPage))
    for (const voie of fermetures) {
      for (const configuration of dialogues) {
        await fermer(configuration, await ouvrir(configuration), voie)
      }
    }
  })

  it('conserve la confirmation obligatoire pour un compte sans mot de passe local', async () => {
    hasPassword = false
    render(createElement(ParametresPage))
    const ouverture = await ouvrir(dialogues[1])
    await waitFor(() => expect(ouverture.champs.queryByLabelText('Votre mot de passe')).toBeNull())
    expect(ouverture.valider.disabled).toBe(true)
    fireEvent.change(ouverture.confirmation, { target: { value: 'SUPPRIMER' } })
    expect(ouverture.valider.disabled).toBe(false)
    await fermer(dialogues[1], ouverture, 'annuler')
    await fermer(dialogues[1], await ouvrir(dialogues[1]), 'Échap')
  })

  it('exige le mot de passe si la lecture du compte échoue', async () => {
    hasPassword = null
    render(createElement(ParametresPage))
    const ouverture = await ouvrir(dialogues[1])
    fireEvent.change(ouverture.confirmation, { target: { value: 'SUPPRIMER' } })
    expect(ouverture.valider.disabled).toBe(true)
    await fermer(dialogues[1], ouverture, 'croix')
  })
})
