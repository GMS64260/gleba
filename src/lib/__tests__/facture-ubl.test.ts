import { describe, expect, it } from 'vitest'
import { buildUblInvoice } from '@/lib/facture-ubl'

describe('buildUblInvoice', () => {
  it('produit un UBL 2.1 structuré et échappe les données utilisateur', () => {
    const xml = buildUblInvoice({
      number: 'F-2026-0042', issueDate: new Date('2026-07-22T10:00:00Z'), currency: 'EUR',
      supplier: { name: 'Ferme & Fils', siret: '123 456 789 00012', address: { street: '1 rue Verte', city: 'Pau', postalCode: '64000', country: 'France' } },
      customer: { name: 'Épicerie <Bio>', siret: '98765432100019', address: { street: '2 rue Bio', city: 'Bayonne', postalCode: '64100', country: 'FR' } },
      lines: [{ id: 1, description: 'Huile & olives', quantity: 2, unit: 'litre', unitPrice: 10, netAmount: 20, vatRate: 5.5 }],
      totalNet: 20, totalVat: 1.1, totalGross: 21.1,
      buyerReference: '98765432100019',
    })
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2')
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>')
    expect(xml).toContain('Ferme &amp; Fils')
    expect(xml).toContain('Épicerie &lt;Bio&gt;')
    expect(xml).toContain('unitCode="LTR"')
    expect(xml).toContain('>21.10</cbc:PayableAmount>')
  })

  it('bloque un document incomplet ou dont les totaux divergent', () => {
    expect(() => buildUblInvoice({
      number: 'F-1', issueDate: new Date(), currency: 'EUR',
      supplier: { name: 'Ferme' }, customer: { name: 'Client' }, buyerReference: null,
      lines: [{ id: 1, description: 'Produit', quantity: 1, unit: 'kg', unitPrice: 10, netAmount: 10, vatRate: 20 }],
      totalNet: 12, totalVat: 2, totalGross: 14,
    })).toThrow(/SIRET|Adresse|Référence|total HT/)
  })
})
