import { describe, expect, it } from "vitest"
import type { DonneesFactureStructuree } from "@/lib/facture-structuree"
import { buildCiiInvoice, validerCii } from "@/lib/facturx/cii"

const facture = (): DonneesFactureStructuree => ({
  number: "F-2026-0042",
  issueDate: new Date("2026-07-22T10:00:00Z"),
  dueDate: new Date("2026-08-21T10:00:00Z"),
  currency: "EUR",
  supplier: { name: "Ferme & Fils", siret: "123 456 789 00012", vatId: "FR 12 123456789", email: "contact@ferme.example", address: { street: "1 rue Verte", city: "Pau", postalCode: "64000", country: "France" } },
  customer: { name: "Épicerie <Bio>", siret: "98765432100019", address: { street: "2 rue Bio", city: "Bayonne", postalCode: "64100", country: "FR" } },
  lines: [
    { id: 1, description: "Huile & olives", quantity: 2, unit: "litre", unitPrice: 10, netAmount: 20, vatRate: 5.5 },
    { id: 2, description: "Prestation de livraison", quantity: 1.5, unit: "heure", unitPrice: 20, netAmount: 30, vatRate: 20 },
  ],
  totalNet: 50,
  totalVat: 7.1,
  totalGross: 57.1,
  paymentReference: "F-2026-0042",
  paymentIban: "FR76 3000 6000 0112 3456 7890 189",
  notes: "Commande de juillet",
  buyerReference: "98765432100019",
  typeCode: "380",
  exonerationTva: null,
  factureOrigine: null,
  conditionsPaiement: "30 jours fin de mois",
})

describe("buildCiiInvoice (Factur-X EN 16931)", () => {
  it("produit un CII D16B conforme au profil EN 16931 avec parties, lignes, TVA et totaux", () => {
    const xml = buildCiiInvoice(facture())
    expect(xml).toContain("urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100")
    expect(xml).toContain("<ram:ID>urn:cen.eu:en16931:2017</ram:ID>")
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>")
    expect(xml).toContain('<udt:DateTimeString format="102">20260722</udt:DateTimeString>')
    expect(xml).toContain('<ram:SellerTradeParty><ram:ID schemeID="0009">12345678900012</ram:ID><ram:Name>Ferme &amp; Fils</ram:Name><ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">123456789</ram:ID>')
    expect(xml).toContain("<ram:CountryID>FR</ram:CountryID>")
    expect(xml).toContain('<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">FR12123456789</ram:ID>')
    expect(xml).toContain("<ram:Name>Épicerie &lt;Bio&gt;</ram:Name>")
    expect(xml).toContain('<ram:BilledQuantity unitCode="LTR">2</ram:BilledQuantity>')
    expect(xml).toContain('<ram:BilledQuantity unitCode="HUR">1.5</ram:BilledQuantity>')
    expect(xml).toContain("<ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>5.50</ram:RateApplicablePercent>")
    expect(xml).toContain("<ram:CalculatedAmount>6.00</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>30.00</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>")
    expect(xml).toContain("<ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>FR7630006000011234567890189</ram:IBANID>")
    expect(xml).toContain("<ram:Description>30 jours fin de mois</ram:Description><ram:DueDateDateTime>")
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">7.10</ram:TaxTotalAmount><ram:GrandTotalAmount>57.10</ram:GrandTotalAmount><ram:DuePayableAmount>57.10</ram:DuePayableAmount>')
    expect(xml).not.toContain("InvoiceReferencedDocument")
  })

  it("franchise en base : catégorie E, code VATEX-FR-FRANCHISE, aucune TVA", () => {
    const f = facture()
    f.lines = [{ id: 1, description: "Légumes", quantity: 10, unit: "kg", unitPrice: 2, netAmount: 20, vatRate: 0 }]
    f.totalNet = 20
    f.totalVat = 0
    f.totalGross = 20
    f.exonerationTva = { code: "VATEX-FR-FRANCHISE", motif: "TVA non applicable, art. 293 B du CGI" }
    const xml = buildCiiInvoice(f)
    expect(xml).toContain("<ram:CategoryCode>E</ram:CategoryCode><ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>")
    expect(xml).toContain("<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>")
    expect(xml).toContain("<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>")
    expect(xml).not.toContain("<ram:CategoryCode>S</ram:CategoryCode>")
  })

  it("refuse une franchise avec une ligne taxée et un avoir sans facture d'origine", () => {
    const f = facture()
    f.exonerationTva = { code: "VATEX-FR-FRANCHISE", motif: "TVA non applicable" }
    expect(validerCii(f)).toContain("Facture en franchise de TVA avec une ligne à taux non nul")
    const avoir = facture()
    avoir.typeCode = "381"
    expect(() => buildCiiInvoice(avoir)).toThrow(/facture d'origine/)
  })

  it("avoir : type 381 et référence à la facture d'origine (BG-3)", () => {
    const avoir = facture()
    avoir.number = "AV-2026-0003"
    avoir.typeCode = "381"
    avoir.factureOrigine = { numero: "F-2026-0042", date: new Date("2026-07-01T12:00:00Z") }
    const xml = buildCiiInvoice(avoir)
    expect(xml).toContain("<ram:TypeCode>381</ram:TypeCode>")
    expect(xml).toContain('<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>F-2026-0042</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString format="102">20260701</qdt:DateTimeString>')
  })

  it("bloque un document incomplet ou dont les totaux divergent, comme l'UBL", () => {
    const f = facture()
    f.supplier.siret = null
    f.totalNet = 60
    expect(() => buildCiiInvoice(f)).toThrow(/SIRET|total HT/)
  })
})
