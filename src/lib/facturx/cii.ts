import { date102Facture } from "@/lib/facture-regles"
import type { DonneesFactureStructuree } from "@/lib/facture-structuree"
import { UblValidationError, codePaysXml as codePays, codeUnite, echapperXml as xml, montantXml as montant, prixUnitaireXml, quantiteXml as quantite, validerFactureStructuree } from "@/lib/facture-ubl"

/**
 * Factur-X, profil EN 16931 : le XML CII (UN/CEFACT Cross Industry Invoice
 * D16B) incorporé dans le PDF/A-3, avec les règles françaises XP Z12-012 v1.3
 * (cadre de facturation BT-23, SIRET en GlobalID 0009, SIREN BT-30/BT-47,
 * adresse électronique 0225, notes codifiées PMT/PMD/AAB et BAR, livraison,
 * option débits, facture déjà payée). Même jeu de données et mêmes contrôles
 * que l'UBL. Le fichier se dépose sur une plateforme agréée : il ne vaut pas
 * transmission. Chantier facturation électronique (lots 0 et 1, 2026-10-12/13).
 */
export const GUIDELINE_EN16931 = "urn:cen.eu:en16931:2017"
export const PROFIL_CII = "EN 16931" as const

function chiffres(value?: string | null): string {
  return (value || "").replace(/\D/g, "")
}

/** Contrôles du Factur-X : ceux partagés avec l'UBL (EN 16931 + BR-FR). */
export function validerCii(donnees: DonneesFactureStructuree): string[] {
  return validerFactureStructuree(donnees)
}

function adresse(a: NonNullable<DonneesFactureStructuree["supplier"]["address"]>): string {
  return (
    `<ram:PostalTradeAddress>` +
    (a.postalCode ? `<ram:PostcodeCode>${xml(a.postalCode)}</ram:PostcodeCode>` : "") +
    (a.street ? `<ram:LineOne>${xml(a.street)}</ram:LineOne>` : "") +
    (a.city ? `<ram:CityName>${xml(a.city)}</ram:CityName>` : "") +
    `<ram:CountryID>${xml(codePays(a.country))}</ram:CountryID>` +
    `</ram:PostalTradeAddress>`
  )
}

function partie(balise: "SellerTradeParty" | "BuyerTradeParty", p: DonneesFactureStructuree["supplier"]): string {
  const siret = chiffres(p.siret)
  const siren = chiffres(p.siren) || (siret.length === 14 ? siret.slice(0, 9) : "")
  // Adresse électronique (BT-34, BT-49) : SIREN sous le schéma français 0225, courriel pour un particulier.
  const adresseElectronique = /^\d{9}$/.test(siren)
    ? `<ram:URIUniversalCommunication><ram:URIID schemeID="0225">${siren}</ram:URIID></ram:URIUniversalCommunication>`
    : p.email?.trim()
      ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${xml(p.email.trim())}</ram:URIID></ram:URIUniversalCommunication>`
      : ""
  // BT-31 numéro de TVA ; à défaut, pour le vendeur, BT-32 identifiant fiscal = SIREN (BR-E-02).
  const fiscal = p.vatId
    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(p.vatId.replace(/\s/g, "").toUpperCase())}</ram:ID></ram:SpecifiedTaxRegistration>`
    : balise === "SellerTradeParty" && siren
      ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${siren}</ram:ID></ram:SpecifiedTaxRegistration>`
      : ""
  return (
    `<ram:${balise}>` +
    (siret ? `<ram:GlobalID schemeID="0009">${siret}</ram:GlobalID>` : "") +
    `<ram:Name>${xml(p.name)}</ram:Name>` +
    (siren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siren}</ram:ID></ram:SpecifiedLegalOrganization>` : "") +
    (p.address ? adresse(p.address) : "") +
    adresseElectronique +
    fiscal +
    `</ram:${balise}>`
  )
}

function categorieTva(taux: number, exoneration: DonneesFactureStructuree["exonerationTva"]): { code: string; motif?: string; codeMotif?: string | null } {
  if (taux === 0) return exoneration ? { code: "E", motif: exoneration.motif, codeMotif: exoneration.code } : { code: "E", motif: "Exonération de TVA" }
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
        `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${prixUnitaireXml(l.unitPrice)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>` +
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${codeUnite(l.unit)}">${quantite(l.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>` +
        `<ram:SpecifiedLineTradeSettlement>` +
        `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${cat.code}</ram:CategoryCode><ram:RateApplicablePercent>${montant(l.vatRate)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>` +
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${montant(l.netAmount)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>` +
        `</ram:SpecifiedLineTradeSettlement>` +
        `</ram:IncludedSupplyChainTradeLineItem>`
      )
    })
    .join("")

  // Ventilation par taux (BG-23), recalculée des lignes comme l'UBL. BT-8
  // (DueDateTypeCode 5 = exigibilité à la facturation) quand l'émetteur a
  // opté pour les débits.
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
        (donnees.optionTvaDebits ? `<ram:DueDateTypeCode>5</ram:DueDateTypeCode>` : "") +
        `<ram:RateApplicablePercent>${montant(taux)}</ram:RateApplicablePercent>` +
        `</ram:ApplicableTradeTax>`
      )
    })
    .join("")

  // Notes (BG-1) : objet libre, conditions et notes saisies (BT-22, sans code
  // sujet, ticket cmvflhyyu), mentions codifiées (BT-21 PMT/PMD/AAB), traitement BAR.
  const notes =
    (donnees.notes ? `<ram:IncludedNote><ram:Content>${xml(donnees.notes)}</ram:Content></ram:IncludedNote>` : "") +
    (donnees.noteLibre ? `<ram:IncludedNote><ram:Content>${xml(donnees.noteLibre)}</ram:Content></ram:IncludedNote>` : "") +
    donnees.mentions.map((m) => `<ram:IncludedNote><ram:Content>${xml(m.texte)}</ram:Content><ram:SubjectCode>${m.code}</ram:SubjectCode></ram:IncludedNote>`).join("") +
    `<ram:IncludedNote><ram:Content>${donnees.traitement}</ram:Content><ram:SubjectCode>BAR</ram:SubjectCode></ram:IncludedNote>`

  // Livraison : adresse si différente (BG-15) et date effective (BT-72).
  const livraison =
    `<ram:ApplicableHeaderTradeDelivery>` +
    (donnees.adresseLivraison ? `<ram:ShipToTradeParty><ram:Name>${xml(donnees.customer.name)}</ram:Name>${adresse(donnees.adresseLivraison)}</ram:ShipToTradeParty>` : "") +
    `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${date102Facture(donnees.dateLivraison)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>` +
    `</ram:ApplicableHeaderTradeDelivery>`

  const iban = donnees.paymentIban?.replace(/\s/g, "")
  const moyenPaiement = iban
    ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${xml(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>`
    : ""
  const conditions =
    donnees.conditionsPaiement || donnees.dueDate
      ? `<ram:SpecifiedTradePaymentTerms>${donnees.conditionsPaiement ? `<ram:Description>${xml(donnees.conditionsPaiement)}</ram:Description>` : ""}${donnees.dueDate ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${date102Facture(donnees.dueDate)}</udt:DateTimeString></ram:DueDateDateTime>` : ""}</ram:SpecifiedTradePaymentTerms>`
      : ""
  const origine = donnees.factureOrigine
    ? `<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>${xml(donnees.factureOrigine.numero)}</ram:IssuerAssignedID><ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${date102Facture(donnees.factureOrigine.date)}</qdt:DateTimeString></ram:FormattedIssueDateTime></ram:InvoiceReferencedDocument>`
    : ""
  // Facture déjà payée (cadre x2, BR-FR-CO-09) : montant payé = TTC, net à payer 0.
  const dejaPaye = donnees.paiement ? `<ram:TotalPrepaidAmount>${montant(donnees.paiement.montant)}</ram:TotalPrepaidAmount>` : ""
  const netAPayer = donnees.paiement ? 0 : donnees.totalGross

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">` +
    `<rsm:ExchangedDocumentContext>` +
    `<ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>${xml(donnees.cadreFacturation)}</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>` +
    `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${GUIDELINE_EN16931}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>` +
    `</rsm:ExchangedDocumentContext>` +
    `<rsm:ExchangedDocument><ram:ID>${xml(donnees.number)}</ram:ID><ram:TypeCode>${donnees.typeCode}</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${date102Facture(donnees.issueDate)}</udt:DateTimeString></ram:IssueDateTime>${notes}</rsm:ExchangedDocument>` +
    `<rsm:SupplyChainTradeTransaction>` +
    lignes +
    `<ram:ApplicableHeaderTradeAgreement>${donnees.buyerReference ? `<ram:BuyerReference>${xml(donnees.buyerReference)}</ram:BuyerReference>` : ""}${partie("SellerTradeParty", donnees.supplier)}${partie("BuyerTradeParty", donnees.customer)}</ram:ApplicableHeaderTradeAgreement>` +
    livraison +
    `<ram:ApplicableHeaderTradeSettlement>` +
    (donnees.paymentReference ? `<ram:PaymentReference>${xml(donnees.paymentReference)}</ram:PaymentReference>` : "") +
    `<ram:InvoiceCurrencyCode>${devise}</ram:InvoiceCurrencyCode>` +
    moyenPaiement +
    taxes +
    conditions +
    `<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${montant(donnees.totalNet)}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>${montant(donnees.totalNet)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="${devise}">${montant(donnees.totalVat)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${montant(donnees.totalGross)}</ram:GrandTotalAmount>${dejaPaye}<ram:DuePayableAmount>${montant(netAPayer)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>` +
    origine +
    `</ram:ApplicableHeaderTradeSettlement>` +
    `</rsm:SupplyChainTradeTransaction>` +
    `</rsm:CrossIndustryInvoice>`
  )
}
