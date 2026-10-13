import { describe, expect, it } from 'vitest'
import { buildUblInvoice, validerFactureStructuree } from '@/lib/facture-ubl'
import { factureStructuree } from './fixtures/facture-structuree'


describe('buildUblInvoice', () => {
  it('produit un UBL 2.1 EN 16931 avec les règles françaises et échappe les données utilisateur', () => {
    const xml = buildUblInvoice(factureStructuree())
    expect(xml).toContain('urn:oasis:names:specification:ubl:schema:xsd:Invoice-2')
    expect(xml).toContain('<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID><cbc:ProfileID>M1</cbc:ProfileID>')
    expect(xml).toContain('<cbc:IssueDate>2026-07-22</cbc:IssueDate><cbc:DueDate>2026-08-21</cbc:DueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>')
    expect(xml).toContain('<cbc:Note>Commande de juillet</cbc:Note><cbc:Note>#AAB#Escompte pour règlement anticipé : néant.</cbc:Note>')
    expect(xml).toContain('<cbc:Note>#BAR#B2B</cbc:Note>')
    expect(xml).toContain('<cac:Party><cbc:EndpointID schemeID="0225">732829320</cbc:EndpointID><cac:PartyIdentification><cbc:ID schemeID="0009">73282932000074</cbc:ID></cac:PartyIdentification>')
    expect(xml).toContain('<cbc:RegistrationName>Ferme &amp; Fils</cbc:RegistrationName><cbc:CompanyID schemeID="0002">732829320</cbc:CompanyID>')
    expect(xml).toContain('<cbc:EndpointID schemeID="0225">552100554</cbc:EndpointID>')
    expect(xml).toContain('Épicerie &lt;Bio&gt;')
    expect(xml).toContain('<cac:Delivery><cbc:ActualDeliveryDate>2026-07-21</cbc:ActualDeliveryDate></cac:Delivery>')
    expect(xml).toContain('unitCode="LTR"')
    expect(xml).toContain('<cbc:PriceAmount currencyID="EUR">10.00</cbc:PriceAmount>')
    expect(xml).toContain('>57.10</cbc:PayableAmount>')
    expect(xml).not.toContain('InvoicePeriod')
    expect(xml).not.toContain('PrepaidAmount')
  })

  it('avoir : racine CreditNote, lignes créditées, facture d’origine en BillingReference', () => {
    const avoir = factureStructuree()
    avoir.number = 'AV-2026-0003'
    avoir.typeCode = '381'
    avoir.factureOrigine = { numero: 'F-2026-0042', date: new Date('2026-07-22T10:00:00Z') }
    const xml = buildUblInvoice(avoir)
    expect(xml).toContain('<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"')
    expect(xml).toContain('<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>')
    expect(xml).toContain('<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>F-2026-0042</cbc:ID><cbc:IssueDate>2026-07-22</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>')
    expect(xml).toContain('<cac:CreditNoteLine><cbc:ID>1</cbc:ID><cbc:CreditedQuantity unitCode="LTR">2</cbc:CreditedQuantity>')
    expect(xml).toContain('<cbc:PaymentDueDate>2026-08-21</cbc:PaymentDueDate>')
    expect(xml).not.toContain('<cbc:DueDate>')
    expect(xml).toContain('</CreditNote>')
  })

  it('facture déjà payée : cadre x2, montant prépayé égal au TTC, net à payer 0, échéance = date de paiement', () => {
    const payee = factureStructuree()
    payee.cadreFacturation = 'M2'
    payee.paiement = { date: new Date('2026-07-25T10:00:00Z'), montant: 57.1 }
    payee.dueDate = payee.paiement.date
    const xml = buildUblInvoice(payee)
    expect(xml).toContain('<cbc:ProfileID>M2</cbc:ProfileID>')
    expect(xml).toContain('<cbc:DueDate>2026-07-25</cbc:DueDate>')
    expect(xml).toContain('<cbc:PrepaidAmount currencyID="EUR">57.10</cbc:PrepaidAmount><cbc:PayableAmount currencyID="EUR">0.00</cbc:PayableAmount>')
  })

  it('franchise en base et option débits : catégorie E avec VATEX-FR-FRANCHISE, identifiant fiscal FC sans TVA, InvoicePeriod 3', () => {
    const f = factureStructuree()
    f.supplier.vatId = null
    f.lines = [{ id: 1, description: 'Légumes', quantity: 10, unit: 'kg', unitPrice: 2, netAmount: 20, vatRate: 0 }]
    f.totalNet = 20
    f.totalVat = 0
    f.totalGross = 20
    f.exonerationTva = { code: 'VATEX-FR-FRANCHISE', motif: 'TVA non applicable, art. 293 B du CGI' }
    f.optionTvaDebits = true
    f.adresseLivraison = { street: '9 route du Marché', postalCode: '64100', city: 'Bayonne', country: 'FR' }
    const xml = buildUblInvoice(f)
    expect(xml).toContain('<cac:PartyTaxScheme><cbc:CompanyID>732829320</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>')
    expect(xml).toContain('<cbc:ID>E</cbc:ID><cbc:Percent>0.00</cbc:Percent><cbc:TaxExemptionReasonCode>VATEX-FR-FRANCHISE</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>TVA non applicable, art. 293 B du CGI</cbc:TaxExemptionReason>')
    expect(xml).toContain('<cac:InvoicePeriod><cbc:DescriptionCode>3</cbc:DescriptionCode></cac:InvoicePeriod>')
    expect(xml).toContain('<cac:DeliveryLocation><cac:Address><cbc:StreetName>9 route du Marché</cbc:StreetName><cbc:CityName>Bayonne</cbc:CityName><cbc:PostalZone>64100</cbc:PostalZone>')
  })

  it('particulier : traitement B2C, adresse électronique par courriel, pas de SIREN exigé', () => {
    const f = factureStructuree()
    f.customer = { name: 'Jean Dupont', email: 'jean@exemple.fr', address: { street: '3 rue Haute', city: 'Pau', postalCode: '64000', country: 'FR' } }
    f.traitement = 'B2C'
    expect(validerFactureStructuree(f)).toEqual([])
    const xml = buildUblInvoice(f)
    expect(xml).toContain('<cbc:Note>#BAR#B2C</cbc:Note>')
    expect(xml).toContain('<cbc:EndpointID schemeID="EM">jean@exemple.fr</cbc:EndpointID>')
  })

  it('bloque un document incomplet ou non conforme aux règles françaises', () => {
    const f = factureStructuree()
    f.supplier.siret = null
    f.supplier.siren = null
    f.customer.address = undefined
    f.totalNet = 60
    f.number = 'F 2026/0042 avec espaces et plus de trente-cinq caractères'
    f.mentions = f.mentions.filter((m) => m.code !== 'PMT')
    f.lines[0].unitPrice = 0
    f.lines[1].quantity = 1.23456
    f.dueDate = new Date('2026-07-01T10:00:00Z')
    const issues = validerFactureStructuree(f)
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringMatching(/Numéro de facture non conforme/),
      expect.stringMatching(/SIRET émetteur/),
      expect.stringMatching(/SIREN émetteur/),
      expect.stringMatching(/Adresse complète client/),
      expect.stringMatching(/Prix unitaire nul/),
      expect.stringMatching(/quatre décimales/),
      expect.stringMatching(/total HT/),
      expect.stringMatching(/Mention codifiée PMT absente/),
      expect.stringMatching(/échéance antérieure/),
    ]))
    expect(() => buildUblInvoice(f)).toThrow(/SIRET|Adresse|total HT/)
  })
})
