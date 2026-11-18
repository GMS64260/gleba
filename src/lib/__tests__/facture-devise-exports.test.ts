import PDFDocument from 'pdfkit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ exploitation: vi.fn(), facture: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {
  exploitation: { findUnique: m.exploitation }, facture: { findFirst: m.facture },
} }))

import { dessinerFacture } from '@/lib/facture-pdf'
import { donneesFactureStructuree, emetteurDeFacture, preparerExportFacture, type FacturePourExport } from '@/lib/facture-structuree'
import { chargerCible } from '@/lib/commercial/envois'
import { buildUblInvoice } from '@/lib/facture-ubl'
import { buildCiiInvoice } from '@/lib/facturx/cii'
import type { EmetteurSnapshot } from '@/lib/facture-utils'

const identite: EmetteurSnapshot = {
  raisonSociale: 'Ferme fictive', formeJuridique: 'EARL', territoire: 'NC', devise: 'XPF',
  siret: '73282932000074', siren: '732829320', identifiantLegal: null,
  numeroTvaIntracom: 'FR44732829320', regimeFiscal: 'micro-BA', regimeTva: 'reel-simplifie', optionTvaDebits: false,
  adresseSiege: '12 chemin fictif', codePostal: '64000', ville: 'Pau', pays: 'FR',
  emailContact: 'ferme@example.test', telContact: null, capitalSocial: null,
  rib: null, bic: null, banqueNom: null, logoUrl: null, certifBioOrganisme: null,
  tauxPenalitesRetard: '3 fois le taux légal', indemniteRecouvrement: 40, tauxEscompte: 'néant',
}
const ancienne = {
  id: 1, userId: 'ferme', numero: 'F-2026-0001', type: 'facture', statut: 'emise',
  date: new Date('2026-06-28T12:00:00Z'), emetteurSnapshot: null,
  clientNom: 'Client fictif', clientAdresse: '1 rue fictive', client: { type: 'particulier', email: 'client@example.test', pays: 'FR', ville: 'Pau', codePostal: '64000' },
  // Seul l'instantané émetteur manque dans ce scénario de monnaie datée.
  // L'acheteur exportable est archivé sur la pièce, sans repli sur sa fiche.
  clientEmail: 'client@example.test', clientPays: 'FR', clientVille: 'Pau', clientCodePostal: '64000',
  clientType: 'particulier', clientSiret: null, clientSiren: null, clientTvaIntra: null, acheteurFigeLe: new Date('2026-06-28T12:00:00Z'),
  totalHT: 100, totalTVA: 5.5, totalTTC: 105.5, mentionsSpecifiques: [],
  lignes: [{ ordre: 0, description: 'Panier fictif', quantite: 1, unite: 'unité', prixUnitaire: 100, tauxTVA: 5.5, montantHT: 100, montantTVA: 5.5, montantTTC: 105.5 }],
} as unknown as FacturePourExport

beforeEach(() => {
  vi.clearAllMocks()
  m.exploitation.mockResolvedValue(identite)
  m.facture.mockResolvedValue(ancienne)
})

function textesPdf(facture: FacturePourExport, emetteur: EmetteurSnapshot | null) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const textes: string[] = []
  const text = doc.text.bind(doc)
  vi.spyOn(doc, 'text').mockImplementation((...args: Parameters<typeof doc.text>) => {
    textes.push(String(args[0]))
    return text(...args)
  })
  doc.resume()
  try { dessinerFacture(doc, facture, emetteur) } finally { doc.end() }
  return textes.join('\n')
}

describe('monnaie datée des éditions et pièces jointes de factures', () => {
  it('complète l’identité courante sans emprunter ses XPF pour une facture ancienne sans snapshot', async () => {
    const emetteur = await emetteurDeFacture(ancienne, 'ferme')
    expect(emetteur).toMatchObject({ raisonSociale: identite.raisonSociale, devise: 'EUR' })
    expect(m.exploitation).toHaveBeenCalledWith({ where: { userId: 'ferme' } })
    const textes = textesPdf(ancienne, emetteur)
    expect(textes).toContain('105,50 €')
    expect(textes).not.toContain('106 F')
    // Même le dessinateur direct ne peut pas emprunter la devise courante.
    expect(textesPdf(ancienne, identite)).toContain('105,50 €')
  })

  it.each(['UBL', 'Factur-X'] as const)('%s émet EUR et conserve les centimes de la facture ancienne', async (format) => {
    const preparation = await preparerExportFacture(ancienne, 'ferme', format)
    expect(preparation.ok).toBe(true)
    if (!preparation.ok) throw new Error(preparation.error)
    expect(preparation.donnees).toMatchObject({ currency: 'EUR', totalGross: 105.5 })
    const xml = format === 'UBL' ? buildUblInvoice(preparation.donnees) : buildCiiInvoice(preparation.donnees)
    expect(xml).toContain(format === 'UBL' ? '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>' : '<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>')
    expect(xml).toContain('105.50')
  })

  it('charge la pièce jointe commerciale dans sa monnaie historique', async () => {
    const cible = await chargerCible('ferme', { type: 'facture', id: '1' })
    expect(cible.emetteur?.devise).toBe('EUR')
    expect(m.facture).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, userId: 'ferme' } }))
    const pdf = await cible.pdf()
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(textesPdf(ancienne, cible.emetteur)).toContain('105,50 €')
  })

  it.each([null, {}])('refuse PDF, exports et envoi d’une facture récente indéterminée (%j)', async (snapshot) => {
    const recente = { ...ancienne, date: new Date('2026-06-29'), emetteurSnapshot: snapshot } as FacturePourExport
    m.facture.mockResolvedValue(recente)
    expect(() => textesPdf(recente, identite)).toThrow('devise historique')
    expect(() => donneesFactureStructuree(recente, identite)).toThrow('devise historique')
    for (const format of ['UBL', 'Factur-X'] as const) {
      expect(await preparerExportFacture(recente, 'ferme', format)).toMatchObject({ ok: false, status: 422, error: expect.stringContaining('devise historique') })
    }
    await expect(chargerCible('ferme', { type: 'facture', id: '1' })).rejects.toMatchObject({ status: 422, message: expect.stringContaining('devise historique') })
  })

  it('garde XPF pour une nouvelle facture explicitement figée et pour un brouillon courant', async () => {
    const recente = { ...ancienne, date: new Date('2026-11-15'), emetteurSnapshot: identite } as unknown as FacturePourExport
    expect((await emetteurDeFacture(recente, 'ferme'))?.devise).toBe('XPF')
    expect(donneesFactureStructuree(recente, identite).currency).toBe('XPF')
    expect(textesPdf(recente, identite)).toContain('106 F')
    const brouillon = { ...recente, statut: 'brouillon', emetteurSnapshot: null }
    expect((await emetteurDeFacture(brouillon, 'ferme'))?.devise).toBe('XPF')
  })
})
