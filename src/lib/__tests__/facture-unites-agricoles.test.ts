import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { buildUblInvoice, codeUnite, UblValidationError, validerFactureStructuree } from '@/lib/facture-ubl'
import { buildCiiInvoice } from '@/lib/facturx/cii'
import { factureStructuree } from './fixtures/facture-structuree'

const m = vi.hoisted(() => ({ facture: vi.fn(), preparation: vi.fn(), pdf: vi.fn() }))
vi.mock('@/lib/auth-utils', () => ({ requireAuthApi: vi.fn(async () => ({ session: { user: { id: 'ferme-fictive' } } })) }))
vi.mock('@/lib/prisma', () => ({ default: { facture: { findFirst: m.facture } } }))
vi.mock('@/lib/facture-structuree', () => ({ preparerExportFacture: m.preparation, entetesRapportExport: () => ({}) }))
vi.mock('@/lib/facture-pdf', () => ({ genererPdfFacture: m.pdf }))

import { GET as ubl } from '@/app/api/comptabilite/factures/[id]/ubl/route'
import { GET as facturx } from '@/app/api/comptabilite/factures/[id]/facturx/route'

function factureAgricole() {
  return {
    ...factureStructuree(),
    lines: [
      { id: 1, description: 'Fleurs fictives', unit: 'tige', quantity: 7, unitPrice: 1.25, netAmount: 8.75, vatRate: 20 },
      { id: 2, description: 'Radis fictifs', unit: 'botte', quantity: 3, unitPrice: 2.2, netAmount: 6.6, vatRate: 5.5 },
    ],
    totalNet: 15.35, totalVat: 2.11, totalGross: 17.46,
  }
}

describe('exports des unités agricoles', () => {
  it('UBL conserve codes, libellés, quantités, prix, HT, TVA et TTC', () => {
    const facture = factureAgricole()
    const avant = structuredClone(facture)
    expect(validerFactureStructuree(facture)).toEqual([])
    const xml = buildUblInvoice(facture)
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="H87">7</cbc:InvoicedQuantity>')
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="XBH">3</cbc:InvoicedQuantity>')
    for (const libelle of ['tige', 'botte']) expect(xml).toContain(`<cbc:Description>Unité de vente : ${libelle}</cbc:Description>`)
    for (const prix of ['1.25', '2.20']) expect(xml).toContain(`<cbc:PriceAmount currencyID="EUR">${prix}</cbc:PriceAmount>`)
    for (const ht of ['8.75', '6.60']) expect(xml).toContain(`<cbc:LineExtensionAmount currencyID="EUR">${ht}</cbc:LineExtensionAmount>`)
    for (const tva of ['1.75', '0.36', '2.11']) expect(xml).toContain(`<cbc:TaxAmount currencyID="EUR">${tva}</cbc:TaxAmount>`)
    expect(xml).toContain('<cbc:TaxExclusiveAmount currencyID="EUR">15.35</cbc:TaxExclusiveAmount>')
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="EUR">17.46</cbc:TaxInclusiveAmount>')
    expect(facture).toEqual(avant)
  })

  it('CII conserve codes, libellés, quantités, prix, HT, TVA et TTC', () => {
    const facture = factureAgricole()
    const avant = structuredClone(facture)
    const xml = buildCiiInvoice(facture)
    expect(xml).toContain('<ram:BilledQuantity unitCode="H87">7</ram:BilledQuantity>')
    expect(xml).toContain('<ram:BilledQuantity unitCode="XBH">3</ram:BilledQuantity>')
    for (const libelle of ['tige', 'botte']) expect(xml).toContain(`<ram:Description>Unité de vente : ${libelle}</ram:Description>`)
    for (const prix of ['1.25', '2.20']) expect(xml).toContain(`<ram:ChargeAmount>${prix}</ram:ChargeAmount>`)
    for (const ht of ['8.75', '6.60', '15.35']) expect(xml).toContain(`<ram:LineTotalAmount>${ht}</ram:LineTotalAmount>`)
    for (const tva of ['1.75', '0.36']) expect(xml).toContain(`<ram:CalculatedAmount>${tva}</ram:CalculatedAmount>`)
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">2.11</ram:TaxTotalAmount>')
    expect(xml).toContain('<ram:GrandTotalAmount>17.46</ram:GrandTotalAmount>')
    expect(facture).toEqual(avant)
  })

  it.each([
    ['tige', 'H87'], ['tiges', 'H87'], [' TIGES ', 'H87'], ['TiGe', 'H87'],
    ['botte', 'XBH'], ['bottes', 'XBH'], [' BOTTES ', 'XBH'], ['BoTtE', 'XBH'],
  ])('normalise explicitement %s dans les deux exports', (unite, code) => {
    const facture = factureAgricole()
    facture.lines[0].unit = unite
    expect(codeUnite(unite)).toBe(code)
    for (const generer of [buildUblInvoice, buildCiiInvoice]) expect(generer(facture)).toContain(`unitCode="${code}"`)
  })

  it.each([
    ['unite', 'C62'], ['unité', 'C62'], ['piece', 'C62'], ['pièce', 'C62'],
    ['kg', 'KGM'], ['g', 'GRM'], ['l', 'LTR'], ['litre', 'LTR'], ['litres', 'LTR'],
    ['h', 'HUR'], ['heure', 'HUR'], ['heures', 'HUR'], ['lot', 'SET'],
  ])('garde le code existant de %s', (unite, code) => {
    expect(codeUnite(unite)).toBe(code)
    const facture = factureAgricole()
    facture.lines.forEach(ligne => { ligne.unit = unite })
    for (const generer of [buildUblInvoice, buildCiiInvoice]) {
      expect(generer(facture).match(/unitCode="[^"]+"/g)).toEqual([`unitCode="${code}"`, `unitCode="${code}"`])
    }
  })

  it.each(['unité-inventée', 'constructor', '__proto__', '', 'tige(s)', 'bottes de 10'])('refuse %j sans repli en pièce', unite => {
    const facture = factureAgricole()
    facture.lines[0].unit = unite
    expect(codeUnite(unite)).toBeNull()
    expect(validerFactureStructuree(facture)).toContain('Unité non reconnue ligne 1')
    for (const generer of [buildUblInvoice, buildCiiInvoice]) expect(() => generer(facture)).toThrow(UblValidationError)
  })
})

// Contrat des handlers avec authentification et stockage simulés ; ceci
// n'est pas une preuve HTTP de cloisonnement avec une session réelle.
describe.each([['ubl', ubl, 'application/xml; charset=utf-8'], ['facturx', facturx, 'application/pdf']] as const)('GET %s : contrat des unités', (format, get, type) => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.facture.mockResolvedValue({ id: 1, numero: 'F-FICTIVE-1' })
    m.preparation.mockResolvedValue({ ok: true, donnees: factureAgricole(), emetteur: {} })
    m.pdf.mockResolvedValue(Buffer.from('%PDF-fictif'))
  })

  const appeler = (id = '1') => get(new NextRequest(`http://localhost/api/comptabilite/factures/${id}/${format}?telecharger=1`), { params: Promise.resolve({ id }) })

  it('renvoie 200 et conserve le type du téléchargement', async () => {
    const reponse = await appeler()
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get('content-type')).toBe(type)
    expect(reponse.headers.get('content-disposition')).toContain('attachment')
    if (format === 'ubl') expect(await reponse.text()).toContain('unitCode="XBH"')
    else expect(m.pdf).toHaveBeenCalledWith(expect.anything(), expect.anything(), { facturX: { xml: expect.stringContaining('unitCode="XBH"'), profil: 'EN 16931' } })
  })

  it('renvoie 422 {error, details} pour une unité inventée, sans PDF', async () => {
    const facture = factureAgricole()
    facture.lines[0].unit = 'unité-inventée'
    const avant = structuredClone(facture)
    m.preparation.mockResolvedValue({ ok: true, donnees: facture, emetteur: {} })
    const reponse = await appeler()
    expect(reponse.status).toBe(422)
    expect(await reponse.json()).toEqual({ error: expect.stringContaining('Facture incomplète'), details: ['Unité non reconnue ligne 1'] })
    expect(m.pdf).not.toHaveBeenCalled()
    expect(facture).toEqual(avant)
  })

  it('conserve 400 pour un id invalide et 404 pour une facture inaccessible', async () => {
    expect((await appeler('invalide')).status).toBe(400)
    expect(m.facture).not.toHaveBeenCalled()
    m.facture.mockResolvedValue(null)
    expect((await appeler()).status).toBe(404)
    expect(m.facture).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, userId: 'ferme-fictive' } }))
    expect(m.preparation).not.toHaveBeenCalled()
  })
})
