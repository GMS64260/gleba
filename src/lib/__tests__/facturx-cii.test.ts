import { describe, expect, it } from "vitest"
import { buildCiiInvoice, validerCii } from "@/lib/facturx/cii"
import { factureStructuree } from "./fixtures/facture-structuree"

const facture = factureStructuree

describe("buildCiiInvoice (Factur-X EN 16931, règles BR-FR)", () => {
  it("produit un CII D16B avec cadre de facturation, parties, notes codifiées, livraison, TVA et totaux", () => {
    const xml = buildCiiInvoice(facture())
    expect(xml).toContain("urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100")
    expect(xml).toContain("<rsm:ExchangedDocumentContext><ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>M1</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID>")
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>")
    expect(xml).toContain('<udt:DateTimeString format="102">20260722</udt:DateTimeString>')
    expect(xml).toContain("<ram:IncludedNote><ram:Content>Commande de juillet</ram:Content></ram:IncludedNote>")
    expect(xml).toContain("<ram:SubjectCode>AAB</ram:SubjectCode>")
    expect(xml).toContain("<ram:SubjectCode>PMD</ram:SubjectCode>")
    expect(xml).toContain("<ram:Content>Indemnité forfaitaire pour frais de recouvrement : 40,00 € (art. L441-10 C. com.).</ram:Content><ram:SubjectCode>PMT</ram:SubjectCode>")
    expect(xml).toContain("<ram:Content>B2B</ram:Content><ram:SubjectCode>BAR</ram:SubjectCode>")
    expect(xml).toContain('<ram:SellerTradeParty><ram:GlobalID schemeID="0009">73282932000074</ram:GlobalID><ram:Name>Ferme &amp; Fils</ram:Name><ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">732829320</ram:ID>')
    expect(xml).toContain('<ram:URIUniversalCommunication><ram:URIID schemeID="0225">732829320</ram:URIID></ram:URIUniversalCommunication><ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">FR44732829320</ram:ID>')
    expect(xml).toContain('<ram:BuyerTradeParty><ram:GlobalID schemeID="0009">55210055400013</ram:GlobalID><ram:Name>Épicerie &lt;Bio&gt;</ram:Name><ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">552100554</ram:ID>')
    expect(xml).toContain("<ram:CountryID>FR</ram:CountryID>")
    expect(xml).not.toContain("BuyerReference")
    expect(xml).toContain('<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">20260721</udt:DateTimeString>')
    expect(xml).toContain('<ram:BilledQuantity unitCode="LTR">2</ram:BilledQuantity>')
    expect(xml).toContain('<ram:BilledQuantity unitCode="HUR">1.5</ram:BilledQuantity>')
    expect(xml).toContain("<ram:ChargeAmount>10.00</ram:ChargeAmount>")
    expect(xml).toContain("<ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>5.50</ram:RateApplicablePercent>")
    expect(xml).toContain("<ram:CalculatedAmount>6.00</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>30.00</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>")
    expect(xml).toContain("<ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>FR7630006000011234567890189</ram:IBANID>")
    expect(xml).toContain("<ram:Description>30 jours fin de mois</ram:Description><ram:DueDateDateTime>")
    expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">7.10</ram:TaxTotalAmount><ram:GrandTotalAmount>57.10</ram:GrandTotalAmount><ram:DuePayableAmount>57.10</ram:DuePayableAmount>')
    expect(xml).not.toContain("InvoiceReferencedDocument")
    expect(xml).not.toContain("DueDateTypeCode")
    expect(xml).not.toContain("TotalPrepaidAmount")
  })

  it("franchise en base sans numéro de TVA : catégorie E, VATEX-FR-FRANCHISE, identifiant fiscal FC = SIREN (BR-E-02)", () => {
    const f = facture()
    f.supplier.vatId = null
    f.lines = [{ id: 1, description: "Légumes", quantity: 10, unit: "kg", unitPrice: 2, netAmount: 20, vatRate: 0 }]
    f.totalNet = 20
    f.totalVat = 0
    f.totalGross = 20
    f.exonerationTva = { code: "VATEX-FR-FRANCHISE", motif: "TVA non applicable, art. 293 B du CGI" }
    const xml = buildCiiInvoice(f)
    expect(xml).toContain("<ram:CategoryCode>E</ram:CategoryCode><ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>")
    expect(xml).toContain("<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>")
    expect(xml).toContain("<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>")
    expect(xml).toContain('<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">732829320</ram:ID></ram:SpecifiedTaxRegistration></ram:SellerTradeParty>')
    expect(xml).not.toContain("<ram:CategoryCode>S</ram:CategoryCode>")
  })

  it("option TVA d'après les débits et adresse de livraison : DueDateTypeCode 5 et ShipToTradeParty", () => {
    const f = facture()
    f.optionTvaDebits = true
    f.adresseLivraison = { street: "9 route du Marché", postalCode: "64100", city: "Bayonne", country: "FR" }
    const xml = buildCiiInvoice(f)
    expect(xml).not.toContain("ExemptionReasonCode")
    expect(xml).toContain("<ram:CategoryCode>S</ram:CategoryCode><ram:DueDateTypeCode>5</ram:DueDateTypeCode><ram:RateApplicablePercent>5.50</ram:RateApplicablePercent>")
    expect(xml).toContain("<ram:ShipToTradeParty><ram:Name>Épicerie &lt;Bio&gt;</ram:Name><ram:PostalTradeAddress><ram:PostcodeCode>64100</ram:PostcodeCode><ram:LineOne>9 route du Marché</ram:LineOne><ram:CityName>Bayonne</ram:CityName><ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress></ram:ShipToTradeParty>")
  })

  it("facture déjà payée : cadre x2, TotalPrepaidAmount = TTC, DuePayableAmount 0, échéance = paiement", () => {
    const f = facture()
    f.cadreFacturation = "M2"
    f.paiement = { date: new Date("2026-07-25T10:00:00Z"), montant: 57.1 }
    f.dueDate = f.paiement.date
    const xml = buildCiiInvoice(f)
    expect(xml).toContain("<ram:ID>M2</ram:ID>")
    expect(xml).toContain('<ram:DueDateDateTime><udt:DateTimeString format="102">20260725</udt:DateTimeString>')
    expect(xml).toContain("<ram:GrandTotalAmount>57.10</ram:GrandTotalAmount><ram:TotalPrepaidAmount>57.10</ram:TotalPrepaidAmount><ram:DuePayableAmount>0.00</ram:DuePayableAmount>")
  })

  it("refuse une franchise avec une ligne taxée, un avoir sans facture d'origine et un cadre inconnu", () => {
    const f = facture()
    f.exonerationTva = { code: "VATEX-FR-FRANCHISE", motif: "TVA non applicable" }
    expect(validerCii(f)).toContain("Facture en franchise de TVA avec une ligne à taux non nul")
    const avoir = facture()
    avoir.typeCode = "381"
    expect(() => buildCiiInvoice(avoir)).toThrow(/facture d'origine/)
    const cadre = facture()
    cadre.cadreFacturation = "S8"
    expect(validerCii(cadre)).toContain("Cadre de facturation non géré (S8)")
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
    f.supplier.siren = null
    f.totalNet = 60
    expect(() => buildCiiInvoice(f)).toThrow(/SIRET|total HT/)
  })

  it("les dates sont le jour calendaire de Paris, pas le jour UTC", () => {
    const f = facture()
    f.issueDate = new Date("2026-10-12T00:00:00+02:00") // 2026-10-11T22:00Z
    f.dueDate = new Date("2026-11-11T00:00:00+01:00")
    f.dateLivraison = f.issueDate
    const xml = buildCiiInvoice(f)
    expect(xml).toContain('<ram:IssueDateTime><udt:DateTimeString format="102">20261012</udt:DateTimeString>')
  })
})
