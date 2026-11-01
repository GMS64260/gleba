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
  tracer: vi.fn(),
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
vi.mock('@/lib/comptabilite/banque/tentatives', () => ({ enregistrerTentativeImport: mocks.tracer }))
vi.mock('@/lib/prisma', () => ({
  default: {
    compteBancaire: { findMany: async () => [] },
    connexionStripe: { findMany: mocks.connexions },
    operationBancaire: { findMany: async () => [] },
  },
}))
import { GET, POST } from './route'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'

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
    // La panne est tracée sans message interne ; le fichier reste rejouable.
    expect(mocks.tracer).toHaveBeenCalledWith(expect.objectContaining({ statut: 'erreur', message: null, source: 'texte' }))
  })

  // 2026-11-01 : un relevé refusé ne laissait aucune trace ; le fichier part
  // maintenant tel quel et chaque tentative est conservée 30 jours.
  const releve = 'Date;Libellé;Débit;Crédit\n02/10/2026;Coop fictive;45,60;\n'
  const fichier = Buffer.from(releve, 'latin1')
  it('décode le fichier d’origine côté serveur et trace un import réussi avec ses octets', async () => {
    mocks.importerReleve.mockResolvedValue({ importees: 1, dejaPresentes: 0 })
    const res = await poster({ action: 'importer', compteId: 'compte-qa', fichier: fichier.toString('base64'), nomFichier: 'releve.csv' })
    expect(res.status).toBe(200)
    expect(mocks.importerReleve).toHaveBeenCalledWith('u1', 'compte-qa', releve)
    const trace = mocks.tracer.mock.calls[0][0]
    expect(trace).toMatchObject({ userId: 'u1', compteId: 'compte-qa', nomFichier: 'releve.csv', source: 'fichier', statut: 'importe', importees: 1, dejaPresentes: 0 })
    expect(Buffer.from(trace.octets).equals(fichier)).toBe(true)
  })
  it('trace un relevé refusé avec le message montré à l’utilisateur', async () => {
    mocks.importerReleve.mockRejectedValue(new ErreurReglement('Ligne 2 : Montant nul.', 400))
    const res = await poster({ action: 'importer', compteId: 'compte-qa', fichier: fichier.toString('base64') })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Ligne 2 : Montant nul.')
    expect(mocks.tracer).toHaveBeenCalledWith(expect.objectContaining({ statut: 'refuse', message: 'Ligne 2 : Montant nul.', source: 'fichier' }))
  })
  it.each([
    ['sans fichier', {}, 400],
    ['fichier et texte à la fois', { fichier: fichier.toString('base64'), csv: releve }, 400],
    ['base64 invalide', { fichier: 'pas du base64 !' }, 400],
    ['plus d’1 Mo une fois décodé', { fichier: Buffer.alloc(1_000_001, 65).toString('base64') }, 413],
  ])('refuse un envoi %s sans rien tracer', async (_cas, corps, statut) => {
    const res = await poster({ action: 'importer', compteId: 'compte-qa', ...corps })
    expect(res.status).toBe(statut)
    expect(mocks.importerReleve).not.toHaveBeenCalled()
    expect(mocks.tracer).not.toHaveBeenCalled()
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
