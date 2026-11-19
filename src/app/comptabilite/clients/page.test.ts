// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ClientsPage from './page'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/lib/global-dialog', () => ({ confirmDialog: vi.fn() }))

const clientFictif = {
  id: 81, nom: 'Client fictif', type: 'professionnel', email: 'client@example.invalid',
  telephone: '0102030405', adresse: 'Rue fictive', ville: 'Ville fictive', codePostal: '12345',
  siret: '12345678900012', siren: '123456789', tvaIntra: 'FR12345678901',
  conditionsPaiement: 30, exonererTVA: true, notes: 'Note fictive', actif: true,
}
const fetchMock = vi.fn<typeof fetch>()
const mutations = () => fetchMock.mock.calls.filter(([, init]) => init?.method)
const corps = (index: number) => JSON.parse(mutations()[index][1]?.body as string)
let refus: { error: string; code?: string; details?: { fieldErrors: Record<string, string[]> } } | null

beforeEach(() => {
  vi.clearAllMocks()
  refus = null
  Element.prototype.scrollIntoView = vi.fn()
  fetchMock.mockImplementation(async (url, init) => {
    if (init?.method) return refus ? Response.json(refus, { status: 409 }) : Response.json({})
    if (String(url).startsWith('/api/comptabilite/clients?')) {
      return Response.json({ data: [clientFictif], stats: null })
    }
    throw new Error(`Requête inattendue : ${String(url)}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

async function ouvrirPage() {
  render(createElement(ClientsPage))
  await screen.findByRole('row', { name: /Client fictif/ })
}

async function creer() {
  fireEvent.click(screen.getByRole('button', { name: 'Nouveau client' }))
  return within(await screen.findByRole('dialog', { name: 'Nouveau client' }))
}

async function choisir(libelle: string, option: string) {
  const controle = screen.getByRole('combobox', { name: libelle })
  fireEvent.keyDown(controle, { key: 'ArrowDown' })
  const choix = await screen.findByRole('option', { name: option })
  fireEvent.keyDown(choix, { key: 'Enter' })
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(controle))
}

const libellesTextes = ['Nom *', 'Email', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Notes']
function verifierChamps(professionnel = false, identifiants = false) {
  const dialogue = screen.getByRole('dialog')
  const champs = within(dialogue)
  const libelles = [...libellesTextes, ...(identifiants ? ['SIRET', professionnel ? 'SIREN *' : 'SIREN', 'N° TVA intracom.'] : [])]
  for (const libelle of libelles) {
    expect(champs.getByLabelText(libelle)).toBe(champs.getByRole('textbox', { name: libelle }))
  }
  for (const libelle of ['Type', 'Conditions de paiement (jours)']) {
    expect(champs.getByLabelText(libelle)).toBe(champs.getByRole('combobox', { name: libelle }))
  }
  expect(champs.getByLabelText('Client exonéré de TVA')).toBe(champs.getByRole('checkbox', { name: 'Client exonéré de TVA' }))
  expect((champs.getByLabelText('Nom *') as HTMLInputElement).required).toBe(true)
  if (identifiants) {
    const siren = champs.getByLabelText(professionnel ? 'SIREN *' : 'SIREN')
    expect(siren.getAttribute('aria-required')).toBe(String(professionnel))
    expect((siren as HTMLInputElement).required).toBe(false)
    if (professionnel) {
      expect(document.getElementById(siren.getAttribute('aria-describedby')!)?.textContent).toContain('Requis : identifiant')
    } else expect(siren.hasAttribute('aria-describedby')).toBe(false)
  }
  const controles = Array.from(dialogue.querySelectorAll('input:not([type="hidden"]), textarea, button[role="combobox"]'))
  expect(controles).toHaveLength(identifiants ? 13 : 10)
  const ids = controles.map(champ => champ.id)
  expect(ids.every(Boolean)).toBe(true)
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ids) expect(Array.from(document.querySelectorAll('[id]')).filter(element => element.id === id)).toHaveLength(1)
}

describe('Clients : noms accessibles du formulaire partagé', () => {
  it('ouvre la création avec le focus sur Nom et nomme chaque champ, y compris les types conditionnels', async () => {
    await ouvrirPage()
    const champs = await creer()
    verifierChamps()
    await waitFor(() => expect(document.activeElement).toBe(champs.getByLabelText('Nom *')))
    for (const type of ['Professionnel', 'Association', 'AMAP']) {
      await choisir('Type', type)
      verifierChamps(type === 'Professionnel', true)
    }
    await choisir('Type', 'Particulier')
    verifierChamps()
    expect(champs.queryByLabelText('SIREN')).toBeNull()
  })

  it('conserve exactement les corps POST puis PATCH, les valeurs éditées et les champs nommés', async () => {
    await ouvrirPage()
    let champs = await creer()
    fireEvent.change(champs.getByLabelText('Nom *'), { target: { value: 'Nouveau fictif' } })
    await choisir('Conditions de paiement (jours)', '15 jours')
    fireEvent.click(champs.getByRole('button', { name: 'Créer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mutations()[0][0]).toBe('/api/comptabilite/clients')
    expect(mutations()[0][1]?.method).toBe('POST')
    expect(corps(0)).toEqual({
      nom: 'Nouveau fictif', type: 'particulier', email: '', telephone: '', adresse: '', ville: '', codePostal: '',
      siret: null, siren: null, tvaIntra: null, conditionsPaiement: 15, exonererTVA: false, notes: '',
    })
    // L'entrée de ligne préexistante est hors du périmètre des champs du formulaire.
    const ligne = await screen.findByRole('row', { name: /Client fictif/ })
    fireEvent.click(within(ligne).getAllByRole('button')[0])
    champs = within(await screen.findByRole('dialog', { name: 'Modifier le client' }))
    verifierChamps(true, true)
    expect((champs.getByLabelText('Nom *') as HTMLInputElement).value).toBe(clientFictif.nom)
    expect(champs.getByRole('combobox', { name: 'Type' }).textContent).toContain('Professionnel')
    expect(champs.getByRole('combobox', { name: 'Conditions de paiement (jours)' }).textContent).toContain('30 jours')
    fireEvent.change(champs.getByLabelText('Nom *'), { target: { value: 'Client modifié' } })
    fireEvent.change(champs.getByLabelText('SIRET'), { target: { value: '987 654 321 00012' } })
    fireEvent.change(champs.getByLabelText('N° TVA intracom.'), { target: { value: 'fr98765432101' } })
    await choisir('Conditions de paiement (jours)', '45 jours')
    fireEvent.click(champs.getByRole('button', { name: 'Modifier' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mutations()[1][0]).toBe('/api/comptabilite/clients')
    expect(mutations()[1][1]?.method).toBe('PATCH')
    const attendu = { ...clientFictif }
    Reflect.deleteProperty(attendu, 'actif')
    expect(corps(1)).toEqual({ ...attendu, nom: 'Client modifié', siret: '987 654 321 00012', siren: '987654321', tvaIntra: 'FR98765432101', conditionsPaiement: 45 })
  })

  it.each(['doublon', 'validation'])('garde le refus serveur %s et la saisie, puis réinitialise à la réouverture', async (cas) => {
    await ouvrirPage()
    const boutonOuvrir = screen.getByRole('button', { name: 'Nouveau client' })
    let champs = await creer()
    fireEvent.change(champs.getByLabelText('Nom *'), { target: { value: 'Saisie conservée' } })
    refus = cas === 'doublon'
      ? { error: 'Ce client existe déjà.', code: 'CLIENT_DOUBLON' }
      : { error: 'Données refusées', details: { fieldErrors: { siren: ['SIREN invalide'] } } }
    fireEvent.click(champs.getByRole('button', { name: 'Créer' }))
    const message = cas === 'doublon' ? 'Ce client existe déjà.' : 'siren: SIREN invalide'
    expect((await champs.findByRole('alert')).textContent).toBe(message)
    expect((champs.getByLabelText('Nom *') as HTMLInputElement).value).toBe('Saisie conservée')
    verifierChamps()
    fireEvent.click(champs.getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(boutonOuvrir))
    champs = await creer()
    expect(champs.queryByRole('alert')).toBeNull()
    expect((champs.getByLabelText('Nom *') as HTMLInputElement).value).toBe('')
    expect(champs.getByRole('combobox', { name: 'Type' }).textContent).toContain('Particulier')
    expect(champs.getByRole('combobox', { name: 'Conditions de paiement (jours)' }).textContent).toContain('Comptant')
    verifierChamps()
  })
})
