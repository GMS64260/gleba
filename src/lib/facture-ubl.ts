export interface UblAddress {
  street?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
}

export interface UblParty {
  name: string
  siret?: string | null
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

function xml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function amount(value: number): string {
  return Number(value).toFixed(2)
}

function date(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function unitCode(value?: string | null): string {
  return UNIT_CODES[(value || '').trim().toLocaleLowerCase('fr-FR')] || 'C62'
}

export class UblValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(' ; '))
  }
}

export function validateUblInvoice(invoice: UblInvoiceData): string[] {
  const issues: string[] = []
  if (!invoice.number.trim()) issues.push('Numéro de facture manquant')
  if (!invoice.supplier.name?.trim()) issues.push('Raison sociale émetteur manquante')
  if (!invoice.supplier.siret?.replace(/\D/g, '').match(/^\d{14}$/)) issues.push('SIRET émetteur invalide (14 chiffres requis)')
  if (!invoice.customer.name?.trim()) issues.push('Nom du client manquant')
  for (const [label, party] of [['émetteur', invoice.supplier], ['client', invoice.customer]] as const) {
    if (!party.address?.street?.trim() || !party.address.city?.trim() || !party.address.postalCode?.trim()) issues.push(`Adresse complète ${label} manquante`)
    const country = (party.address?.country || 'FR').trim().toUpperCase()
    if (country !== 'FRANCE' && !/^[A-Z]{2}$/.test(country)) issues.push(`Code pays ${label} invalide (ISO alpha-2 requis)`)
  }
  if (!invoice.buyerReference?.trim()) issues.push('Référence acheteur obligatoire manquante')
  if (invoice.lines.length === 0) issues.push('La facture ne contient aucune ligne')
  for (const [index, line] of invoice.lines.entries()) {
    if (!line.description.trim()) issues.push(`Description manquante ligne ${index + 1}`)
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) issues.push(`Quantité invalide ligne ${index + 1}`)
    if (!Number.isFinite(line.netAmount) || !Number.isFinite(line.unitPrice) || !Number.isFinite(line.vatRate)) issues.push(`Montant ou TVA invalide ligne ${index + 1}`)
    if (!UNIT_CODES[(line.unit || '').trim().toLocaleLowerCase('fr-FR')]) issues.push(`Unité non reconnue ligne ${index + 1}`)
  }
  const round = (value: number) => Math.round(value * 100) / 100
  const net = round(invoice.lines.reduce((sum, line) => sum + line.netAmount, 0))
  const vat = round(invoice.lines.reduce((sum, line) => sum + line.netAmount * line.vatRate / 100, 0))
  if (net !== round(invoice.totalNet)) issues.push('Le total HT ne correspond pas aux lignes')
  if (vat !== round(invoice.totalVat)) issues.push('Le total TVA ne correspond pas aux lignes')
  if (round(invoice.totalNet + invoice.totalVat) !== round(invoice.totalGross)) issues.push('Le total TTC ne correspond pas à HT + TVA')
  return issues
}

function partyXml(tag: 'AccountingSupplierParty' | 'AccountingCustomerParty', party: UblParty): string {
  const address = party.address
  const identifier = party.siret
    ? `<cac:PartyIdentification><cbc:ID schemeID="0009">${xml(party.siret.replace(/\D/g, ''))}</cbc:ID></cac:PartyIdentification>`
    : ''
  const postal = address
    ? `<cac:PostalAddress>${address.street ? `<cbc:StreetName>${xml(address.street)}</cbc:StreetName>` : ''}${address.city ? `<cbc:CityName>${xml(address.city)}</cbc:CityName>` : ''}${address.postalCode ? `<cbc:PostalZone>${xml(address.postalCode)}</cbc:PostalZone>` : ''}<cac:Country><cbc:IdentificationCode>${xml((address.country || 'FR').toUpperCase() === 'FRANCE' ? 'FR' : address.country || 'FR')}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>`
    : ''
  const vat = party.vatId
    ? `<cac:PartyTaxScheme><cbc:CompanyID>${xml(party.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
    : ''
  const legal = `<cac:PartyLegalEntity><cbc:RegistrationName>${xml(party.name)}</cbc:RegistrationName>${party.siret ? `<cbc:CompanyID schemeID="0009">${xml(party.siret.replace(/\D/g, ''))}</cbc:CompanyID>` : ''}</cac:PartyLegalEntity>`
  const contact = party.email ? `<cac:Contact><cbc:ElectronicMail>${xml(party.email)}</cbc:ElectronicMail></cac:Contact>` : ''
  return `<cac:${tag}><cac:Party>${identifier}<cac:PartyName><cbc:Name>${xml(party.name)}</cbc:Name></cac:PartyName>${postal}${vat}${legal}${contact}</cac:Party></cac:${tag}>`
}

/** UBL 2.1 / EN16931 : fichier structuré à faire valider et transmettre par une PA. */
export function buildUblInvoice(invoice: UblInvoiceData): string {
  const issues = validateUblInvoice(invoice)
  if (issues.length) throw new UblValidationError(issues)
  const currency = invoice.currency || 'EUR'
  const taxByRate = new Map<number, { net: number; vat: number }>()
  for (const line of invoice.lines) {
    const current = taxByRate.get(line.vatRate) || { net: 0, vat: 0 }
    current.net += line.netAmount
    current.vat += line.netAmount * line.vatRate / 100
    taxByRate.set(line.vatRate, current)
  }
  const taxSubtotals = [...taxByRate.entries()].map(([rate, totals]) => {
    const category = rate === 0 ? 'E' : 'S'
    return `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="${xml(currency)}">${amount(totals.net)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${xml(currency)}">${amount(totals.vat)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${category}</cbc:ID><cbc:Percent>${amount(rate)}</cbc:Percent>${rate === 0 ? '<cbc:TaxExemptionReason>Exonération de TVA</cbc:TaxExemptionReason>' : ''}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`
  }).join('')
  const lines = invoice.lines.map((line) => `<cac:InvoiceLine><cbc:ID>${xml(line.id)}</cbc:ID><cbc:InvoicedQuantity unitCode="${unitCode(line.unit)}">${line.quantity}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${xml(currency)}">${amount(line.netAmount)}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${xml(line.description)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${line.vatRate === 0 ? 'E' : 'S'}</cbc:ID><cbc:Percent>${amount(line.vatRate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${xml(currency)}">${amount(line.unitPrice)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`).join('')

  const paymentMeans = invoice.paymentIban
    ? `<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>${invoice.paymentReference ? `<cbc:PaymentID>${xml(invoice.paymentReference)}</cbc:PaymentID>` : ''}<cac:PayeeFinancialAccount><cbc:ID>${xml(invoice.paymentIban.replace(/\s/g, ''))}</cbc:ID></cac:PayeeFinancialAccount></cac:PaymentMeans>`
    : `<cac:PaymentMeans><cbc:PaymentMeansCode>1</cbc:PaymentMeansCode>${invoice.paymentReference ? `<cbc:PaymentID>${xml(invoice.paymentReference)}</cbc:PaymentID>` : ''}</cac:PaymentMeans>`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID><cbc:ID>${xml(invoice.number)}</cbc:ID><cbc:IssueDate>${date(invoice.issueDate)}</cbc:IssueDate>${invoice.dueDate ? `<cbc:DueDate>${date(invoice.dueDate)}</cbc:DueDate>` : ''}<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>${invoice.notes ? `<cbc:Note>${xml(invoice.notes)}</cbc:Note>` : ''}<cbc:DocumentCurrencyCode>${xml(currency)}</cbc:DocumentCurrencyCode><cbc:BuyerReference>${xml(invoice.buyerReference)}</cbc:BuyerReference>${partyXml('AccountingSupplierParty', invoice.supplier)}${partyXml('AccountingCustomerParty', invoice.customer)}${paymentMeans}<cac:TaxTotal><cbc:TaxAmount currencyID="${xml(currency)}">${amount(invoice.totalVat)}</cbc:TaxAmount>${taxSubtotals}</cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${xml(currency)}">${amount(invoice.totalNet)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${xml(currency)}">${amount(invoice.totalNet)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${xml(currency)}">${amount(invoice.totalGross)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${xml(currency)}">${amount(invoice.totalGross)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</Invoice>`
}
