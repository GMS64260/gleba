/**
 * Revue du 2026-10-29 : les erreurs inattendues de la route Banque rendaient
 * un 500 sans aucune trace serveur ; la déconnexion Stripe ne disait rien de
 * la révocation chez Stripe ; une connexion au jeton illisible paraissait
 * simplement désactivée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  importerReleve: vi.fn(),
  deconnecter: vi.fn(),
  connexions: vi.fn(),
}))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: mocks.auth }))
vi.mock('@/lib/demo-garde', () => ({ estCompteDemo: vi.fn(async () => false) }))
vi.mock('@/lib/comptabilite/banque/service', () => ({
  compteDTO: (c: unknown) => c,
  operationDTO: (o: unknown) => o,
  importerReleve: mocks.importerReleve,
  rapprocherOperation: vi.fn(),
  rapprocherVirement: vi.fn(),
  defaireVirement: vi.fn(),
  validerOperationRevisee: vi.fn(),
}))
vi.mock('@/lib/comptabilite/banque/stripe-oauth', () => ({ deconnecterStripe: mocks.deconnecter }))
vi.mock('@/lib/prisma', () => ({
  default: {
    compteBancaire: { findMany: async () => [] },
    connexionStripe: { findMany: mocks.connexions },
    operationBancaire: { findMany: async () => [] },
  },
}))
import { GET, POST } from './route'

const session = { user: { id: 'u1', acteurId: 'u1', estProprietaireExploitation: true, peutEcrireExploitation: true } }
const poster = async (corps: object) => {
  const res = await POST(new NextRequest('http://localhost/api/comptabilite/banque', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  if (!res) throw new Error('Réponse absente')
  return res
}

beforeEach(() => mocks.auth.mockResolvedValue({ error: null, session }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('POST /api/comptabilite/banque', () => {
  it('journalise une erreur inattendue sans le corps de la requête et garde un message générique', async () => {
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.importerReleve.mockRejectedValue(new Error('panne base fictive'))

    const res = await poster({ action: 'importer', compteId: 'compte-qa', csv: 'date;libelle;montant\nIBAN-FICTIF' })

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('L’opération bancaire n’a pas pu être terminée.')
    expect(journal).toHaveBeenCalledWith('POST /api/comptabilite/banque error:', expect.objectContaining({ message: 'panne base fictive' }))
    expect(journal.mock.calls.flat().map(String).join(' ')).not.toContain('IBAN-FICTIF')
  })

  it('rend à l’écran le message et l’avertissement de la déconnexion Stripe', async () => {
    mocks.deconnecter.mockResolvedValue({ message: 'Accès retiré de Gleba, historique conservé.', avertissement: 'Stripe n’a pas confirmé la révocation.' })

    const res = await poster({ action: 'deconnecter', connexionId: 'cx-qa' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, message: 'Accès retiré de Gleba, historique conservé.', avertissement: 'Stripe n’a pas confirmé la révocation.' })
    expect(mocks.deconnecter).toHaveBeenCalledWith('u1', 'cx-qa')
  })
})

describe('GET /api/comptabilite/banque', () => {
  it('signale une connexion au jeton illisible sans jamais renvoyer le jeton', async () => {
    mocks.connexions.mockResolvedValue([
      { id: 'cx-erreur', actif: false, modeTest: false, derniereSynchro: null, historiqueComplet: true, curseurNouveaux: null, jetonChiffre: 'v1:chiffre-fictif' },
      { id: 'cx-retiree', actif: false, modeTest: false, derniereSynchro: null, historiqueComplet: true, curseurNouveaux: null, jetonChiffre: '' },
    ])

    const corps = await (await GET(new NextRequest('http://localhost/api/comptabilite/banque'))).json()

    expect(corps.connexions[0].erreur).toMatch(/Reconnectez Stripe/)
    expect(corps.connexions[1].erreur).toBeNull()
    expect(JSON.stringify(corps)).not.toContain('chiffre-fictif')
  })
})
