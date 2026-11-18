// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FacturesPage from './page'

const { toast, ouvrirApercu } = vi.hoisted(() => ({ toast: vi.fn(), ouvrirApercu: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/hooks/use-devise', () => ({ useDevise: () => 'XPF' }))
vi.mock('@/hooks/use-exploitation', () => ({ useExploitation: () => ({ peutEcrire: true }) }))
vi.mock('@/lib/apercu-document', () => ({ ouvrirApercu }))
vi.mock('@/lib/global-dialog', () => ({ confirmDialog: async () => true }))
vi.mock('next/navigation', () => ({ usePathname: () => '/comptabilite/factures' }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'test-fictif' } }, status: 'authenticated' }) }))
vi.mock('@/components/commercial/ChoisirStock', () => ({ ChoisirStock: () => null, prixHTDuStock: vi.fn() }))
vi.mock('@/components/commercial/EnvoyerDocument', () => ({ EnvoyerDocument: () => null }))
// La facturation du document est testée dans son composant ; ici, son contrat
// de succès doit actualiser les deux listes de la page parente.
vi.mock('@/components/commercial/DocumentsCommerciaux', () => ({
  DocumentsCommerciaux: ({ onFacture }: { onFacture: () => void }) => createElement('button', { onClick: onFacture }, 'Document facturé'),
}))

interface FactureFictive {
  id: number
  numero: string
  type: string
  statut: string
  date: string
  dateEcheance: null
  clientNom: string
  totalHT: number
  totalTTC: number
  montantRegle: number
  factureOrigineId?: number
  emetteurSnapshot: { devise: string; territoire: string }
  mouvementsStock?: Array<{ quantite: number }>
}

function facture(): FactureFictive {
  return {
    id: 1, numero: 'TEST-F-001', type: 'facture', statut: 'emise',
    date: `${new Date().getFullYear()}-01-05`, dateEcheance: null,
    clientNom: 'Client fictif', totalHT: 100, totalTTC: 100, montantRegle: 0,
    emetteurSnapshot: { devise: 'EUR', territoire: 'FR' },
  }
}

const fetchMock = vi.fn<typeof fetch>()
let factures: FactureFictive[]
let refus: string | null
const lecturesImpayees = () => fetchMock.mock.calls.filter(([url]) => url === '/api/comptabilite/factures?year=all').length
const lecturesEmises = () => fetchMock.mock.calls.filter(([url]) => url === `/api/comptabilite/factures?year=${new Date().getFullYear()}`).length

beforeEach(() => {
  vi.clearAllMocks()
  factures = []
  refus = null
  window.history.replaceState(null, '', '/comptabilite/factures?tab=impayees')
  window.localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  fetchMock.mockImplementation(async (url, init) => {
    const chemin = String(url)
    if (chemin === '/api/comptabilite/factures' && init?.method) {
      if (refus) return Response.json({ error: refus }, { status: 409 })
      const corps = JSON.parse(init.body as string)
      if (init.method === 'PATCH') {
        factures = factures.map(f => f.id === corps.id ? { ...f, statut: corps.statut } : f)
        return Response.json({ data: factures[0] })
      }
      const piece: FactureFictive = {
        ...facture(), ...corps, id: factures.length + 1,
        numero: corps.type === 'avoir' ? 'TEST-AV-001' : 'TEST-F-001', statut: 'emise',
      }
      factures = [...factures, piece]
      return Response.json({ data: piece }, { status: 201 })
    }
    if (chemin.startsWith('/api/comptabilite/factures?')) return Response.json({ data: factures })
    if (chemin.endsWith('/stock') && init?.method === 'POST') {
      factures = factures.map(f => ({ ...f, mouvementsStock: [{ quantite: -1 }, { quantite: 1 }] }))
      return Response.json({})
    }
    if (chemin === '/api/comptabilite/reglements' && init?.method === 'POST') {
      if (refus) return Response.json({ error: refus }, { status: 409 })
      const corps = JSON.parse(init.body as string)
      factures = factures.map(f => ({ ...f, montantRegle: f.montantRegle + Number(corps.montant) }))
      return Response.json({})
    }
    if (chemin.startsWith('/api/comptabilite/reglements?')) {
      const f = factures[0]
      return Response.json({
        cible: { type: 'Facture', id: f.id }, devise: 'EUR', libelle: f.numero,
        montantTotal: f.totalTTC, montantPieceAvantAvoirs: f.totalTTC, montantRegle: f.montantRegle,
        resteAPayer: f.totalTTC - f.montantRegle, tropPercu: 0,
        detaille: true, historiquePaye: false, historiqueDeclarePaye: false, reglements: [],
      })
    }
    if (chemin === '/api/exploitation') return Response.json({ data: { regimeTva: 'franchise' } })
    if (chemin.startsWith('/api/comptabilite/clients') || chemin.startsWith('/api/elevage/ventes?') || chemin.startsWith('/api/comptabilite/ventes-manuelles?')) return Response.json({ data: [] })
    throw new Error(`Requête inattendue : ${chemin}`)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

function onglet(nom: string) {
  fireEvent.mouseDown(screen.getByRole('tab', { name: new RegExp(`^${nom}`) }), { button: 0, ctrlKey: false })
  return within(screen.getByRole('tabpanel'))
}

async function ouvrir() {
  render(createElement(FacturesPage))
  await waitFor(() => expect(lecturesImpayees()).toBe(1))
  await waitFor(() => expect(screen.queryAllByRole('row').length || screen.queryByText('Toutes les factures sont payées !')).toBeTruthy())
}

async function montantDu(montant: string) {
  const panneau = onglet('Impayées')
  await waitFor(() => {
    const carte = panneau.getByText('Montant total dû').parentElement!.parentElement!
    expect(carte.textContent?.replace(/\s/g, ' ')).toContain(montant === '0' ? '0 F' : `${montant} €`)
  })
  return panneau
}

async function creerAvoir() {
  const panneau = onglet('Avoir')
  fireEvent.keyDown(panneau.getAllByRole('combobox')[0], { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('option', { name: /TEST-F-001/ }))
  fireEvent.change(panneau.getByPlaceholderText('0.00'), { target: { value: '25' } })
  fireEvent.change(panneau.getByPlaceholderText('Ex: Marchandise retournée, erreur de facturation…'), { target: { value: 'Remise fictive' } })
  fireEvent.click(panneau.getByRole('button', { name: "Créer l'avoir" }))
  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Avoir créé' })))
}

describe('Factures : actualisation des créances après mutation', () => {
  it('affiche immédiatement 100 EUR après création puis 75 EUR après un avoir de 25 EUR, même avec une exploitation XPF', async () => {
    await ouvrir()
    const panneau = onglet('Nouvelle facture')
    fireEvent.change(panneau.getByLabelText('Nom du client *'), { target: { value: 'Client fictif' } })
    fireEvent.change(panneau.getByPlaceholderText('Description'), { target: { value: 'Prestation fictive' } })
    fireEvent.change(panneau.getAllByRole('spinbutton')[1], { target: { value: '100' } })
    fireEvent.click(panneau.getByRole('button', { name: 'Enregistrer et générer le PDF' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Facture enregistrée' })))
    expect((await montantDu('100,00')).getByText('TEST-F-001')).toBeTruthy()
    await creerAvoir()
    const impayees = await montantDu('75,00')
    expect(impayees.getByRole('row', { name: /TEST-F-001/ }).textContent?.replace(/\s/g, ' ')).toContain('75,00 €')
    expect(ouvrirApercu).toHaveBeenCalledTimes(2)
  })

  it('actualise aussi une facture déjà présente après création d’un avoir', async () => {
    factures = [facture()]
    await ouvrir()
    await montantDu('100,00')
    await creerAvoir()
    await montantDu('75,00')
  })

  it('retire immédiatement la créance après annulation de la facture', async () => {
    factures = [facture()]
    await ouvrir()
    fireEvent.click(onglet('Factures émises').getByTitle('Annuler la facture'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Facture annulée' }))
    expect((await montantDu('0')).getByText('Toutes les factures sont payées !')).toBeTruthy()
  })

  it('conserve la créance et l’erreur existante si l’annulation est refusée en HTTP', async () => {
    factures = [facture()]
    refus = 'Annulation fictive refusée'
    await ouvrir()
    fireEvent.click(onglet('Factures émises').getByTitle('Annuler la facture'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ variant: 'destructive', title: 'Erreur', description: refus }))
    expect((await montantDu('100,00')).getByText('TEST-F-001')).toBeTruthy()
    expect(lecturesImpayees()).toBe(1)
    expect(lecturesEmises()).toBe(1)
  })

  it.each(['Impayées', 'Factures émises'])('ajuste puis retire la créance après règlements depuis %s', async (depart) => {
    factures = [facture()]
    await ouvrir()
    for (const [versement, restant] of [['25', '75,00'], ['75', '0']]) {
      fireEvent.click(onglet(depart).getByRole('button', { name: 'Règlements' }))
      const dialogue = within(await screen.findByRole('dialog'))
      const montant = await dialogue.findByLabelText('Montant reçu ou versé')
      fireEvent.change(montant, { target: { value: versement } })
      fireEvent.change(dialogue.getByLabelText('Mode de règlement'), { target: { value: 'Espèces' } })
      fireEvent.click(dialogue.getByRole('button', { name: 'Enregistrer ce règlement' }))
      await waitFor(() => expect(factures[0].montantRegle).toBe(100 - (restant === '0' ? 0 : 75)))
      // Le dialogue peut être démonté par le chargement des impayées.
      await waitFor(() => expect(lecturesImpayees()).toBe(restant === '0' ? 3 : 2))
      const fermer = screen.queryByRole('button', { name: 'Close' })
      if (fermer) fireEvent.click(fermer)
      await montantDu(restant)
    }
    expect(screen.getByText('Toutes les factures sont payées !')).toBeTruthy()
    expect(lecturesEmises()).toBe(3)
  })

  it('conserve la créance et affiche l’erreur HTTP d’un règlement refusé', async () => {
    factures = [facture()]
    refus = 'Règlement fictif refusé'
    await ouvrir()
    fireEvent.click(onglet('Factures émises').getByRole('button', { name: 'Règlements' }))
    const dialogue = within(await screen.findByRole('dialog'))
    await dialogue.findByLabelText('Montant reçu ou versé')
    fireEvent.change(dialogue.getByLabelText('Mode de règlement'), { target: { value: 'Espèces' } })
    fireEvent.click(dialogue.getByRole('button', { name: 'Enregistrer ce règlement' }))
    expect((await dialogue.findByRole('alert')).textContent).toBe(refus)
    fireEvent.click(dialogue.getByRole('button', { name: 'Close' }))
    await montantDu('100,00')
    expect(lecturesImpayees()).toBe(1)
  })

  it.each(['Devis', 'Bons de livraison'])('actualise les deux listes après facturation depuis %s', async (depart) => {
    await ouvrir()
    const documents = onglet(depart)
    factures = [facture()]
    fireEvent.click(documents.getByRole('button', { name: 'Document facturé' }))
    expect(await screen.findByText('TEST-F-001')).toBeTruthy()
    expect((await montantDu('100,00')).getByText('TEST-F-001')).toBeTruthy()
    expect(lecturesEmises()).toBe(2)
  })

  it('le retour physique en stock actualise uniquement les factures sans modifier la créance', async () => {
    factures = [{ ...facture(), mouvementsStock: [{ quantite: -1 }] }]
    await ouvrir()
    fireEvent.click(onglet('Factures émises').getByRole('button', { name: 'Retour en stock' }))
    expect(await screen.findByText('Stock retourné')).toBeTruthy()
    await montantDu('100,00')
    expect(lecturesImpayees()).toBe(1)
    expect(lecturesEmises()).toBe(2)
  })
})
