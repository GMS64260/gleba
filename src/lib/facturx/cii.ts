import { UblValidationError, codeUnite, echapperXml as xml, validateUblInvoice } from "@/lib/facture-ubl"
import type { DonneesFactureStructuree } from "@/lib/facture-structuree"

/**
 * Factur-X, profil EN 16931 : le XML CII (UN/CEFACT Cross Industry Invoice
 * D16B) incorporé dans le PDF/A-3. Même jeu de données que l'export UBL,
 * mêmes contrôles (`validateUblInvoice`), plus les règles propres à la
 * catégorie de TVA. Ce fichier est à faire valider par une plateforme agréée
 * avant toute transmission : il ne vaut pas dépôt. Chantier facturation
 * électronique (2026-10-12), cadrage dans le vault.
 */
export const GUIDELINE_EN16931 = "urn:cen.eu:en16931:2017"
export const PROFIL_CII = "EN 16931" as const

function montant(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2)
}

function quantite(value: number): string {
  return String(Math.round(value * 10000) / 10000)
}

/** Date au format 102 (AAAAMMJJ), jour UTC comme l'export UBL. */
function date102(value: Date): string {
  return value.toISOString().slice(0, 10).replaceAll("-", "")
}

function codePays(value?: string | null): string {
  const pays = (value || "FR").trim().toUpperCase()
  return pays === "FRANCE" ? "FR" : pays
}

function chiffres(value?: string | null): string {
  return (value || "").replace(/\D/g, "")
}

/** Contrôles propres au CII, en plus de ceux partagés avec l'UBL. */
export function validerCii(donnees: DonneesFactureStructuree): string[] {
  const issues = validateUblInvoice(donnees)
  if (donnees.exonerationTva) {
    if (donnees.lines.some((l) => l.vatRate !== 0)) issues.push("Facture en franchise de TVA avec une ligne à taux non nul")
    if (Math.abs(donnees.totalVat) >= 0.005) issues.push("Facture en franchise de TVA avec un total de TVA non nul")
  }
  if (donnees.typeCode === "381" && !donnees.factureOrigine) issues.push("Avoir sans facture d'origine (référence obligatoire)")
  if (donnees.supplier.vatId && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(donnees.supplier.vatId.replace(/\s/g, "").toUpperCase())) issues.push("Numéro de TVA intracommunautaire émetteur invalide")
  return issues
}

function partie(balise: "SellerTradeParty" | "BuyerTradeParty", p: DonneesFactureStructuree["supplier"]): string {
  const siret = chiffres(p.siret)
  const siren = siret.length === 14 ? siret.slice(0, 9) : ""
  const adresse = p.address
  const postal = adresse
    ? `<ram:PostalTradeAddress>${adresse.postalCode ? `<ram:PostcodeCode>${xml(adresse.postalCode)}</ram:PostcodeCode>` : ""}${adresse.street ? `<ram:LineOne>${xml(adresse.street)}</ram:LineOne>` : ""}${adresse.city ? `<ram:CityName>${xml(adresse.city)}</ram:CityName>` : ""}<ram:CountryID>${xml(codePays(adresse.country))}</ram:CountryID></ram:PostalTradeAddress>`
    : ""
  return (
    `<ram:${balise}>` +
    (siret ? `<ram:ID schemeID="0009">${siret}</ram:ID>` : "") +
    `<ram:Name>${xml(p.name)}</ram:Name>` +
    (siren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siren}</ram:ID></ram:SpecifiedLegalOrganization>` : "") +
    postal +
    (p.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${xml(p.email)}</ram:URIID></ram:URIUniversalCommunication>` : "") +
    (p.vatId ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(p.vatId.replace(/\s/g, "").toUpperCase())}</ram:ID></ram:SpecifiedTaxRegistration>` : "") +
    `</ram:${balise}>`
  )
}

function categorieTva(taux: number, exoneration: DonneesFactureStructuree["exonerationTva"]): { code: string; motif?: string; codeMotif?: string } {
  if (exoneration) return { code: "E", motif: exoneration.motif, codeMotif: exoneration.code }
  if (taux === 0) return { code: "E", motif: "Exonération de TVA" }
  return { code: "S" }
}

/** CII D16B, profil EN 16931 : à incorporer dans un PDF/A-3 (`attacherFacturX`). */
export function buildCiiInvoice(donnees: DonneesFactureStructuree): string {
  const issues = validerCii(donnees)
  if (issues.length) throw new UblValidationError(issues)
  const devise = xml(donnees.currency || "EUR")

  const lignes = donnees.lines
    .map((l) => {
      const cat = categorieTva(l.vatRate, donnees.exonerationTva)
      return (
        `<ram:IncludedSupplyChainTradeLineItem>` +
        `<ram:AssociatedDocumentLineDocument><ram:LineID>${xml(l.id)}</ram:LineID></ram:AssociatedDocumentLineDocument>` +
        `<ram:SpecifiedTradeProduct><ram:Name>${xml(l.description)}</ram:Name></ram:SpecifiedTradeProduct>` +
        `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${montant(l.unitPrice)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>` +
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${codeUnite(l.unit)}">${quantite(l.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>` +
        `<ram:SpecifiedLineTradeSettlement>` +
        `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat.code}</ram:CategoryCode><ram:RateApplicablePercent>${montant(l.vatRate)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>` +
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${montant(l.netAmount)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>` +
        `</ram:SpecifiedLineTradeSettlement>` +
        `</ram:IncludedSupplyChainTradeLineItem>`
      )
    })
    .join("")

  // Ventilation par taux (BG-23), recalculée des lignes comme l'UBL.
  const parTaux = new Map<number, { base: number; tva: number }>()
  for (const l of donnees.lines) {
    const cumul = parTaux.get(l.vatRate) || { base: 0, tva: 0 }
    cumul.base += l.netAmount
    cumul.tva += (l.netAmount * l.vatRate) / 100
    parTaux.set(l.vatRate, cumul)
  }
  const taxes = [...parTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, t]) => {
      const cat = categorieTva(taux, donnees.exonerationTva)
      return (
        `<ram:ApplicableTradeTax>` +
        `<ram:CalculatedAmount>${montant(t.tva)}</ram:CalculatedAmount>` +
        `<ram:TypeCode>VAT</ram:TypeCode>` +
        (cat.motif ? `<ram:ExemptionReason>${xml(cat.motif)}</ram:ExemptionReason>` : "") +
        `<ram:BasisAmount>${montant(t.base)}</ram:BasisAmount>` +
        `<ram:CategoryCode>${cat.code}</ram:CategoryCode>` +
        (cat.codeMotif ? `<ram:ExemptionReasonCode>${xml(cat.codeMotif)}</ram:ExemptionReasonCode>` : "") +
        `<ram:RateApplicablePercent>${montant(taux)}</ram:RateApplicablePercent>` +
        `</ram:ApplicableTradeTax>`
      )
    })
    .join("")

  const iban = donnees.paymentIban?.replace(/\s/g, "")
  const moyenPaiement = iban
    ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${xml(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>`
    : ""
  const conditions =
    donnees.conditionsPaiement || donnees.dueDate
      ? `<ram:SpecifiedTradePaymentTerms>${donnees.conditionsPaiement ? `<ram:Description>${xml(donnees.conditionsPaiement)}</ram:Description>` : ""}${donnees.dueDate ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${date102(donnees.dueDate)}</udt:DateTimeString></ram:DueDateDateTime>` : ""}</ram:SpecifiedTradePaymentTerms>`
      : ""
  const origine = donnees.factureOrigine
    ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${xml(donnees.factureOrigine.numero)}</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${date102(donnees.factureOrigine.date)}</qdt:DateTimeString></ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>`
    : ""

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">` +
    `<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${GUIDELINE_EN16931}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>` +
    `<rsm:ExchangedDocument><ram:ID>${xml(donnees.number)}</ram:ID><ram:TypeCode>${donnees.typeCode}</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${date102(donnees.issueDate)}</udt:DateTimeString></ram:IssueDateTime>${donnees.notes ? `<ram:IncludedNote><ram:Content>${xml(donnees.notes)}</ram:Content></ram:IncludedNote>` : ""}</rsm:ExchangedDocument>` +
    `<rsm:SupplyChainTradeTransaction>` +
    lignes +
    `<ram:ApplicableHeaderTradeAgreement><ram:BuyerReference>${xml(donnees.buyerReference)}</ram:BuyerReference>${partie("SellerTradeParty", donnees.supplier)}${partie("BuyerTradeParty", donnees.customer)}</ram:ApplicableHeaderTradeAgreement>` +
    `<ram:ApplicableHeaderTradeDelivery/>` +
    `<ram:ApplicableHeaderTradeSettlement>` +
    (donnees.paymentReference ? `<ram:PaymentReference>${xml(donnees.paymentReference)}</ram:PaymentReference>` : "") +
    `<ram:InvoiceCurrencyCode>${devise}</ram:InvoiceCurrencyCode>` +
    moyenPaiement +
    taxes +
    conditions +
    `<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${montant(donnees.totalNet)}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>${montant(donnees.totalNet)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="${devise}">${montant(donnees.totalVat)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${montant(donnees.totalGross)}</ram:GrandTotalAmount><ram:DuePayableAmount>${montant(donnees.totalGross)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>` +
    origine +
    `</ram:ApplicableHeaderTradeSettlement>` +
    `</rsm:SupplyChainTradeTransaction>` +
    `</rsm:CrossIndustryInvoice>`
  )
}
