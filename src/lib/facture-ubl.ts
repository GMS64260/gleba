import { CADRES_FACTURATION_GLEBA, dateIsoFacture } from '@/lib/facture-regles'
import type { DonneesFactureStructuree } from '@/lib/facture-structuree'

export interface UblAddress {
  street?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
}

export interface UblParty {
  name: string
  siret?: string | null
  /** SIREN (BT-30 vendeur, BT-47 acheteur), dérivé du SIRET à défaut. */
  siren?: string | null
  vatId?: string | null
  email?: string | null
  address?: UblAddress
}

export interface UblInvoiceLine {
  id: string | number
  description: string
  quantity: number
  unit?: string | null
  unitPrice: number
  netAmount: number
  vatRate: number
}

export interface UblInvoiceData {
  number: string
  issueDate: Date
  dueDate?: Date | null
  currency: string
  supplier: UblParty
  customer: UblParty
  lines: UblInvoiceLine[]
  totalNet: number
  totalVat: number
  totalGross: number
  paymentReference?: string | null
  paymentIban?: string | null
  notes?: string | null
  buyerReference?: string | null
}

const UNIT_CODES: Record<string, string> = {
  unite: 'C62', unité: 'C62', piece: 'C62', pièce: 'C62',
  kg: 'KGM', g: 'GRM', l: 'LTR', litre: 'LTR', litres: 'LTR',
  h: 'HUR', heure: 'HUR', heures: 'HUR', lot: 'SET',
}

/** Taux de TVA admis par la norme XP Z12-012 (BR-FR-16), métropole, Corse et DROM compris. */
const TAUX_TVA_ADMIS = [0, 0.9, 1.05, 1.75, 2.1, 5.5, 7, 8.5, 9.2, 9.6, 10, 13, 19.6, 20, 20.6]

function xml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function amount(value: number): string {
  return (Math.round(Number(value) * 100) / 100).toFixed(2)
}

/** Quantité à quatre décimales au plus (BR-FR-DEC-02). */
function quantity(value: number): string {
  return String(Math.round(value * 10000) / 10000)
}

/** Prix unitaire à six décimales au plus (BR-FR-DEC-03), deux au moins pour la lisibilité. */
function unitPrice(value: number): string {
  const six = (Math.round(value * 1e6) / 1e6).toFixed(6)
  return six.replace(/0+$/, '').replace(/\.(\d)$/, '.$10').replace(/\.$/, '.00')
}

function unitCode(value?: string | null): string {
  return UNIT_CODES[(value || '').trim().toLocaleLowerCase('fr-FR')] || 'C62'
}

function countryCode(value?: string | null): string {
  const pays = (value || 'FR').trim().toUpperCase()
  return pays === 'FRANCE' ? 'FR' : pays
}

function digits(value?: string | null): string {
  return (value || '').replace(/\D/g, '')
}

function decimals(value: number, max: number): boolean {
  const facteur = 10 ** max
  return Math.abs(value * facteur - Math.round(value * facteur)) < 1e-6
}

export class UblValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(' ; '))
  }
}

/**
 * Contrôles de complétude et de cohérence communs à l'UBL et au Factur-X :
 * EN 16931 (parties, adresses, totaux) et règles françaises XP Z12-012 v1.3
 * (BR-FR : identifiants, mentions codifiées, cadre de facturation, décimales,
 * échéance, facture déjà payée). Renvoie une liste d'erreurs actionnable.
 */
export function validerFactureStructuree(d: DonneesFactureStructuree): string[] {
  const issues: string[] = []
  const numero = d.number.trim()
  if (!numero) issues.push('Numéro de facture manquant')
  else if (numero.length > 35 || !/^[A-Za-z0-9+_/-]+$/.test(numero)) issues.push('Numéro de facture non conforme (35 caractères au plus, lettres, chiffres, + - _ /)')

  if (!d.supplier.name?.trim()) issues.push('Raison sociale émetteur manquante')
  const siretEmetteur = digits(d.supplier.siret)
  if (!/^\d{14}$/.test(siretEmetteur)) issues.push('SIRET émetteur invalide (14 chiffres requis)')
  const sirenEmetteur = digits(d.supplier.siren) || siretEmetteur.slice(0, 9)
  if (!/^\d{9}$/.test(sirenEmetteur)) issues.push('SIREN émetteur manquant (9 chiffres, BT-30)')
  else if (siretEmetteur && !siretEmetteur.startsWith(sirenEmetteur)) issues.push('Le SIRET émetteur ne commence pas par son SIREN')
  if (d.supplier.vatId && !/^[A-Z]{2}[A-Z0-9]{2,13}$/.test(d.supplier.vatId.replace(/\s/g, '').toUpperCase())) issues.push('Numéro de TVA intracommunautaire émetteur invalide')

  if (!d.customer.name?.trim()) issues.push('Nom du client manquant')
  const siretClient = digits(d.customer.siret)
  const sirenClient = digits(d.customer.siren)
  if (siretClient && !/^\d{14}$/.test(siretClient)) issues.push('SIRET client invalide (14 chiffres requis)')
  if (sirenClient && !/^\d{9}$/.test(sirenClient)) issues.push('SIREN client invalide (9 chiffres requis)')
  if (siretClient && sirenClient && !siretClient.startsWith(sirenClient)) issues.push('Le SIRET client ne commence pas par son SIREN')
  if (d.traitement === 'B2B' && !/^\d{9}$/.test(sirenClient)) issues.push("SIREN de l'acheteur manquant (client professionnel, obligatoire sur une facture électronique, BT-47) : complétez le SIRET ou le SIREN de la fiche client")
  // Adresse électronique de l'acheteur (BT-49, BR-FR-12) : SIREN sous 0225, sinon courriel. Le schematron l'exige aussi en B2C.
  if (!adresseElectronique(d.customer)) issues.push("Adresse électronique de l'acheteur manquante (BT-49) : renseignez le courriel du client")

  for (const [label, party] of [['émetteur', d.supplier], ['client', d.customer]] as const) {
    if (!party.address?.street?.trim() || !party.address.city?.trim() || !party.address.postalCode?.trim()) issues.push(`Adresse complète ${label} manquante`)
    const country = (party.address?.country || 'FR').trim().toUpperCase()
    if (country !== 'FRANCE' && !/^[A-Z]{2}$/.test(country)) issues.push(`Code pays ${label} invalide (ISO alpha-2 requis)`)
  }
  if (d.adresseLivraison && (!d.adresseLivraison.street?.trim() || !d.adresseLivraison.city?.trim() || !d.adresseLivraison.postalCode?.trim())) {
    issues.push('Adresse de livraison incomplète (voie, code postal et ville requis)')
  }

  if (d.lines.length === 0) issues.push('La facture ne contient aucune ligne')
  for (const [index, line] of d.lines.entries()) {
    const n = index + 1
    if (!line.description.trim()) issues.push(`Description manquante ligne ${n}`)
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) issues.push(`Quantité invalide ligne ${n}`)
    else if (!decimals(line.quantity, 4)) issues.push(`Quantité à plus de quatre décimales ligne ${n}`)
    if (!Number.isFinite(line.netAmount) || !Number.isFinite(line.unitPrice) || !Number.isFinite(line.vatRate)) issues.push(`Montant ou TVA invalide ligne ${n}`)
    else if (line.unitPrice < 0) issues.push(`Prix unitaire négatif ligne ${n} (BR-27 ; une ligne offerte se saisit à 0)`)
    if (!TAUX_TVA_ADMIS.includes(line.vatRate)) issues.push(`Taux de TVA non admis ligne ${n} (${line.vatRate} %)`)
    if (!UNIT_CODES[(line.unit || '').trim().toLocaleLowerCase('fr-FR')]) issues.push(`Unité non reconnue ligne ${n}`)
  }
  const round = (value: number) => Math.round(value * 100) / 100
  const net = round(d.lines.reduce((sum, line) => sum + line.netAmount, 0))
  const vat = round(d.lines.reduce((sum, line) => sum + line.netAmount * line.vatRate / 100, 0))
  if (net !== round(d.totalNet)) issues.push('Le total HT ne correspond pas aux lignes')
  if (vat !== round(d.totalVat)) issues.push('Le total TVA ne correspond pas aux lignes')
  if (round(d.totalNet + d.totalVat) !== round(d.totalGross)) issues.push('Le total TTC ne correspond pas à HT + TVA')

  if (d.exonerationTva) {
    if (d.lines.some((l) => l.vatRate !== 0)) issues.push('Facture en franchise de TVA avec une ligne à taux non nul')
    if (Math.abs(d.totalVat) >= 0.005) issues.push('Facture en franchise de TVA avec un total de TVA non nul')
  }
  if (d.typeCode === '381' && !d.factureOrigine) issues.push("Avoir sans facture d'origine (référence obligatoire)")
  if (!(CADRES_FACTURATION_GLEBA as readonly string[]).includes(d.cadreFacturation)) issues.push(`Cadre de facturation non géré (${d.cadreFacturation})`)
  for (const code of ['AAB', 'PMD', 'PMT'] as const) {
    const n = d.mentions.filter((m) => m.code === code && m.texte.trim()).length
    if (n !== 1) issues.push(`Mention codifiée ${code} ${n === 0 ? 'absente' : 'en double'} (escompte, pénalités, indemnité de recouvrement)`)
  }
  if (d.paiement) {
    if (round(d.paiement.montant) !== round(d.totalGross)) issues.push('Facture payée : le montant réglé doit être égal au total TTC')
  } else if (d.dueDate && d.typeCode !== '386' && dateIsoFacture(d.dueDate) < dateIsoFacture(d.issueDate)) {
    issues.push("Date d'échéance antérieure à la date de facture")
  }
  return issues
}

/** Alias historique (lot 0) : mêmes contrôles pour les deux formats. */
export const validateUblInvoice = validerFactureStructuree

function partyXml(tag: 'AccountingSupplierParty' | 'AccountingCustomerParty', party: UblParty, adresseElectronique: { valeur: string; scheme: string } | null): string {
  const address = party.address
  const siret = digits(party.siret)
  const siren = digits(party.siren) || (siret.length === 14 ? siret.slice(0, 9) : '')
  const endpoint = adresseElectronique ? `<cbc:EndpointID schemeID="${xml(adresseElectronique.scheme)}">${xml(adresseElectronique.valeur)}</cbc:EndpointID>` : ''
  const identifier = siret ? `<cac:PartyIdentification><cbc:ID schemeID="0009">${siret}</cbc:ID></cac:PartyIdentification>` : ''
  const postal = address
    ? `<cac:PostalAddress>${address.street ? `<cbc:StreetName>${xml(address.street)}</cbc:StreetName>` : ''}${address.city ? `<cbc:CityName>${xml(address.city)}</cbc:CityName>` : ''}${address.postalCode ? `<cbc:PostalZone>${xml(address.postalCode)}</cbc:PostalZone>` : ''}<cac:Country><cbc:IdentificationCode>${xml(countryCode(address.country))}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`
    : ''
  // BT-31 (TVA) ou, à défaut, BT-32 identifiant fiscal : le SIREN (BR-E-02 exige l'un des deux dès qu'une ligne est exonérée).
  const vat = party.vatId
    ? `<cac:PartyTaxScheme><cbc:CompanyID>${xml(party.vatId.replace(/\s/g, '').toUpperCase())}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
    : tag === 'AccountingSupplierParty' && siren
      ? `<cac:PartyTaxScheme><cbc:CompanyID>${siren}</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
      : ''
  const legal = `<cac:PartyLegalEntity><cbc:RegistrationName>${xml(party.name)}</cbc:RegistrationName>${siren ? `<cbc:CompanyID schemeID="0002">${siren}</cbc:CompanyID>` : ''}</cac:PartyLegalEntity>`
  const contact = party.email ? `<cac:Contact><cbc:ElectronicMail>${xml(party.email)}</cbc:ElectronicMail></cac:Contact>` : ''
  return `<cac:${tag}><cac:Party>${endpoint}${identifier}<cac:PartyName><cbc:Name>${xml(party.name)}</cbc:Name></cac:PartyName>${postal}${vat}${legal}${contact}</cac:Party></cac:${tag}>`
}

/**
 * Adresse électronique (BT-34 vendeur, BT-49 acheteur) : en France le SIREN
 * sous le schéma 0225 (BR-FR-21), le courriel (EM) pour un particulier.
 */
function adresseElectronique(party: UblParty): { valeur: string; scheme: string } | null {
  const siren = digits(party.siren) || digits(party.siret).slice(0, 9)
  if (/^\d{9}$/.test(siren)) return { valeur: siren, scheme: '0225' }
  if (party.email?.trim()) return { valeur: party.email.trim(), scheme: 'EM' }
  return null
}

function taxCategoryXml(rate: number, exoneration: DonneesFactureStructuree['exonerationTva'], avecMotif: boolean): string {
  const category = rate === 0 ? 'E' : 'S'
  const motif = rate === 0 ? exoneration?.motif || 'Exonération de TVA' : null
  const code = rate === 0 ? exoneration?.code || null : null
  return (
    `<cbc:ID>${category}</cbc:ID><cbc:Percent>${amount(rate)}</cbc:Percent>` +
    (avecMotif && code ? `<cbc:TaxExemptionReasonCode>${xml(code)}</cbc:TaxExemptionReasonCode>` : '') +
    (avecMotif && motif ? `<cbc:TaxExemptionReason>${xml(motif)}</cbc:TaxExemptionReason>` : '') +
    `<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`
  )
}

/**
 * UBL 2.1 / EN 16931 avec les règles françaises XP Z12-012 : `Invoice` (380,
 * 386) ou `CreditNote` (381, avec la facture d'origine en BillingReference).
 * Fichier structuré à déposer sur une plateforme agréée : il ne vaut pas
 * transmission.
 */
export function buildUblInvoice(d: DonneesFactureStructuree): string {
  const issues = validerFactureStructuree(d)
  if (issues.length) throw new UblValidationError(issues)
  const currency = d.currency || 'EUR'
  const avoir = d.typeCode === '381'
  const root = avoir ? 'CreditNote' : 'Invoice'
  const ligne = avoir ? 'CreditNoteLine' : 'InvoiceLine'
  const quantite = avoir ? 'CreditedQuantity' : 'InvoicedQuantity'

  const taxByRate = new Map<number, { net: number; vat: number }>()
  for (const line of d.lines) {
    const current = taxByRate.get(line.vatRate) || { net: 0, vat: 0 }
    current.net += line.netAmount
    current.vat += line.netAmount * line.vatRate / 100
    taxByRate.set(line.vatRate, current)
  }
  const taxSubtotals = [...taxByRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, totals]) => `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${xml(currency)}">${amount(totals.net)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${xml(currency)}">${amount(totals.vat)}</cbc:TaxAmount><cac:TaxCategory>${taxCategoryXml(rate, d.exonerationTva, true)}</cac:TaxCategory></cac:TaxSubtotal>`)
    .join('')
  const lines = d.lines
    .map((line) => `<cac:${ligne}><cbc:ID>${xml(line.id)}</cbc:ID><cbc:${quantite} unitCode="${unitCode(line.unit)}">${quantity(line.quantity)}</cbc:${quantite}><cbc:LineExtensionAmount currencyID="${xml(currency)}">${amount(line.netAmount)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${xml(line.description)}</cbc:Name><cac:ClassifiedTaxCategory>${taxCategoryXml(line.vatRate, d.exonerationTva, false)}</cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${unitPrice(line.unitPrice)}</cbc:PriceAmount></cac:Price></cac:${ligne}>`)
    .join('')

  // Notes (BG-1) : objet libre, mentions codifiées #CODE# (BT-21), traitement BAR.
  const notes =
    (d.notes ? `<cbc:Note>${xml(d.notes)}</cbc:Note>` : '') +
    d.mentions.map((m) => `<cbc:Note>#${m.code}#${xml(m.texte)}</cbc:Note>`).join('') +
    `<cbc:Note>#BAR#${d.traitement}</cbc:Note>`
  // BT-8 : option TVA d'après les débits = exigibilité à la date de facture (UNTDID 2005 : 3).
  const periode = d.optionTvaDebits ? `<cac:InvoicePeriod><cbc:DescriptionCode>3</cbc:DescriptionCode></cac:InvoicePeriod>` : ''
  const billingReference = d.factureOrigine
    ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${xml(d.factureOrigine.numero)}</cbc:ID><cbc:IssueDate>${dateIsoFacture(d.factureOrigine.date)}</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>`
    : ''
  const livraison = d.adresseLivraison
    ? `<cac:DeliveryLocation><cac:Address>${d.adresseLivraison.street ? `<cbc:StreetName>${xml(d.adresseLivraison.street)}</cbc:StreetName>` : ''}${d.adresseLivraison.city ? `<cbc:CityName>${xml(d.adresseLivraison.city)}</cbc:CityName>` : ''}${d.adresseLivraison.postalCode ? `<cbc:PostalZone>${xml(d.adresseLivraison.postalCode)}</cbc:PostalZone>` : ''}<cac:Country><cbc:IdentificationCode>${xml(countryCode(d.adresseLivraison.country))}</cbc:IdentificationCode></cac:Country></cac:Address></cac:DeliveryLocation>`
    : ''
  const delivery = `<cac:Delivery><cbc:ActualDeliveryDate>${dateIsoFacture(d.dateLivraison)}</cbc:ActualDeliveryDate>${livraison}</cac:Delivery>`

  const paymentId = d.paymentReference ? `<cbc:PaymentID>${xml(d.paymentReference)}</cbc:PaymentID>` : ''
  // Un CreditNote UBL 2.1 n'a pas de DueDate en tête : l'échéance va dans PaymentMeans (BT-9).
  const paymentDueDate = avoir && d.dueDate ? `<cbc:PaymentDueDate>${dateIsoFacture(d.dueDate)}</cbc:PaymentDueDate>` : ''
  const paymentMeans = d.paymentIban
    ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>${paymentDueDate}${paymentId}<cac:PayeeFinancialAccount><cbc:ID>${xml(d.paymentIban.replace(/\s/g, ''))}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>`
    : `<cac:PaymentMeans><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode>${paymentDueDate}${paymentId}</cac:PaymentMeans>`
  const paymentTerms = d.conditionsPaiement ? `<cac:PaymentTerms><cbc:Note>${xml(d.conditionsPaiement)}</cbc:Note></cac:PaymentTerms>` : ''
  const prepaid = d.paiement ? `<cbc:PrepaidAmount currencyID="${xml(currency)}">${amount(d.paiement.montant)}</cbc:PrepaidAmount>` : ''
  const payable = d.paiement ? 0 : d.totalGross

  const entete = avoir
    ? `<cbc:ID>${xml(d.number)}</cbc:ID><cbc:IssueDate>${dateIsoFacture(d.issueDate)}</cbc:IssueDate><cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>${notes}<cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode>`
    : `<cbc:ID>${xml(d.number)}</cbc:ID><cbc:IssueDate>${dateIsoFacture(d.issueDate)}</cbc:IssueDate>${d.dueDate ? `<cbc:DueDate>${dateIsoFacture(d.dueDate)}</cbc:DueDate>` : ''}<cbc:InvoiceTypeCode>${d.typeCode}</cbc:InvoiceTypeCode>${notes}<cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode>`

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">` +
    `<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID><cbc:ProfileID>${xml(d.cadreFacturation)}</cbc:ProfileID>` +
    entete +
    (d.buyerReference ? `<cbc:BuyerReference>${xml(d.buyerReference)}</cbc:BuyerReference>` : '') +
    periode +
    billingReference +
    partyXml('AccountingSupplierParty', d.supplier, adresseElectronique(d.supplier)) +
    partyXml('AccountingCustomerParty', d.customer, adresseElectronique(d.customer)) +
    delivery +
    paymentMeans +
    paymentTerms +
    `<cac:TaxTotal><cbc:TaxAmount currencyID="${xml(currency)}">${amount(d.totalVat)}</cbc:TaxAmount>${taxSubtotals}</cac:TaxTotal>` +
    `<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${xml(currency)}">${amount(d.totalNet)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${amount(d.totalNet)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${amount(d.totalGross)}</cbc:TaxInclusiveAmount>${prepaid}<cbc:PayableAmount currencyID="${xml(currency)}">${amount(payable)}</cbc:PayableAmount></cac:LegalMonetaryTotal>` +
    lines +
    `</${root}>`
  )
}

/** Partagés avec le générateur Factur-X (CII) : même échappement, mêmes formats. */
export const echapperXml = xml
export const codeUnite = unitCode
export const montantXml = amount
export const quantiteXml = quantity
export const prixUnitaireXml = unitPrice
export const codePaysXml = countryCode
