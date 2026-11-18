import { describe, expect, it } from 'vitest'
import { buildUblInvoice } from '@/lib/facture-ubl'
import { buildCiiInvoice } from '@/lib/facturx/cii'
import type { DonneesFactureStructuree } from '@/lib/facture-structuree'
import { factureStructuree } from '@/lib/__tests__/fixtures/facture-structuree'
import { codeUnite, normaliserUniteFacture } from './unites-facture'

const GRAINE = 20261118
const NOMBRE_CAS = 320

function generateur() {
  let etat = GRAINE >>> 0
  return (borne: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return Math.floor(etat / 2 ** 32 * borne)
  }
}

// Oracle indépendant de la table de production : changer un code dans
// celle-ci doit casser la propriété, même si les deux exports le partagent.
const UNITES = [
  { variantes: ['unite', 'unité', 'unites', 'unités'], code: 'C62' },
  { variantes: ['piece', 'pièce', 'pieces', 'pièces'], code: 'C62' },
  { variantes: ['kg'], code: 'KGM' },
  { variantes: ['g'], code: 'GRM' },
  { variantes: ['l', 'litre', 'litres'], code: 'LTR' },
  { variantes: ['h', 'heure', 'heures'], code: 'HUR' },
  { variantes: ['lot', 'lots'], code: 'SET' },
  { variantes: ['tige', 'tiges'], code: 'H87' },
  { variantes: ['botte', 'bottes'], code: 'XBH' },
]

function varier(unite: string, entier: (borne: number) => number) {
  const espaces = ['', ' ', '\t', '\n', '\u00a0']
  const casse = Array.from(unite, c => entier(2) ? c.toUpperCase() : c).join('')
  return espaces[entier(espaces.length)] + casse.normalize(entier(2) ? 'NFC' : 'NFD') + espaces[entier(espaces.length)]
}

function valeurs(xml: string, balise: string) {
  return Array.from(xml.matchAll(new RegExp(`<${balise}(?:\\s[^>]*)?>([^<]*)</${balise}>`, 'g')), match => Number(match[1]))
}

function verifierExport(xml: string, facture: DonneesFactureStructuree, format: 'UBL' | 'CII') {
  const lignes = Array.from(xml.matchAll(format === 'UBL'
    ? /<cac:(?:InvoiceLine|CreditNoteLine)>([\s\S]*?)<\/cac:(?:InvoiceLine|CreditNoteLine)>/g
    : /<ram:IncludedSupplyChainTradeLineItem>([\s\S]*?)<\/ram:IncludedSupplyChainTradeLineItem>/g), m => m[1])
  expect(lignes).toHaveLength(2)
  lignes.forEach((ligne, index) => {
    const source = facture.lines[index]
    expect(ligne.match(/unitCode="([^"]+)"/)?.[1]).toBe(index === 0 ? 'H87' : 'XBH')
    const quantite = format === 'UBL' ? (facture.typeCode === '381' ? 'cbc:CreditedQuantity' : 'cbc:InvoicedQuantity') : 'ram:BilledQuantity'
    expect(valeurs(ligne, quantite)).toEqual([source.quantity])
    expect(valeurs(ligne, format === 'UBL' ? 'cbc:PriceAmount' : 'ram:ChargeAmount')).toEqual([source.unitPrice])
    expect(valeurs(ligne, format === 'UBL' ? 'cbc:LineExtensionAmount' : 'ram:LineTotalAmount')).toEqual([source.netAmount])
    expect(valeurs(ligne, format === 'UBL' ? 'cbc:Percent' : 'ram:RateApplicablePercent')).toEqual([source.vatRate])
  })
  expect(valeurs(xml, format === 'UBL' ? 'cbc:TaxExclusiveAmount' : 'ram:TaxBasisTotalAmount')).toEqual([facture.totalNet])
  expect(valeurs(xml, format === 'UBL' ? 'cbc:TaxAmount' : 'ram:TaxTotalAmount')[0]).toBe(facture.totalVat)
  expect(valeurs(xml, format === 'UBL' ? 'cbc:TaxInclusiveAmount' : 'ram:GrandTotalAmount')).toEqual([facture.totalGross])
}

function facturesGenerees() {
  const entier = generateur()
  return Array.from({ length: NOMBRE_CAS }, (_, i) => {
    const facture = factureStructuree()
    facture.lines = ['tige', 'botte'].map((unite, index) => {
      const quantity = (1 + entier(100_000)) / 10_000
      const unitPrice = i % 11 === 0 ? 0 : entier(100_000_001) / 1_000_000
      return {
        id: index + 1, description: 'Produit fictif généré',
        unit: varier(unite + (entier(2) ? 's' : ''), entier),
        quantity, unitPrice, netAmount: Math.round(quantity * unitPrice * 100) / 100,
        vatRate: index === 0 ? 20 : 5.5,
      }
    })
    facture.totalNet = Math.round(facture.lines.reduce((s, l) => s + l.netAmount, 0) * 100) / 100
    // Entrées avec TVA arrondie par ligne, comme les factures enregistrées.
    // La propriété porte sur leur conservation, pas sur la politique d'arrondi.
    facture.totalVat = facture.lines.reduce((s, l) => s + Math.round((l.netAmount * l.vatRate / 100) * 100), 0) / 100
    facture.totalGross = Math.round((facture.totalNet + facture.totalVat) * 100) / 100
    facture.typeCode = (['380', '381', '386'] as const)[i % 3]
    if (facture.typeCode === '381') facture.factureOrigine = { numero: 'F-FICTIVE-ORIGINE', date: facture.issueDate }
    return facture
  })
}

describe(`unités de facture — graine ${GRAINE}, ${NOMBRE_CAS} entrées par propriété`, () => {
  it('la normalisation est idempotente, y compris pour les unités inconnues', () => {
    const entier = generateur()
    for (let i = 0; i < NOMBRE_CAS; i++) {
      const unite = UNITES[i % UNITES.length]
      const entree = varier(i % 5 === 0 ? `inconnue-${i}` : unite.variantes[entier(unite.variantes.length)], entier)
      const normalisee = normaliserUniteFacture(entree)
      expect(normaliserUniteFacture(normalisee), `cas ${i}`).toBe(normalisee)
    }
  })

  it('le code est stable entre variantes, casse, espaces et formes Unicode', () => {
    const entier = generateur()
    for (let i = 0; i < NOMBRE_CAS; i++) {
      const unite = UNITES[i % UNITES.length]
      for (const variante of unite.variantes) {
        const entree = varier(variante, entier)
        expect(codeUnite(entree), `cas ${i} : ${entree}`).toBe(unite.code)
        expect(codeUnite(normaliserUniteFacture(entree))).toBe(unite.code)
      }
    }
  })

  it('la sérialisation UBL et CII conserve quantités, prix et montants enregistrés sans mutation', () => {
    for (const facture of facturesGenerees()) {
      const avant = structuredClone(facture)
      verifierExport(buildUblInvoice(facture), facture, 'UBL')
      verifierExport(buildCiiInvoice(facture), facture, 'CII')
      expect(facture).toEqual(avant)
    }
  })

  it('le témoin détecte un code falsifié dans chaque export', () => {
    for (const facture of facturesGenerees()) {
      for (const [format, generer] of [['UBL', buildUblInvoice], ['CII', buildCiiInvoice]] as const) {
        const xml = generer(facture)
        const falsifie = xml.replace('unitCode="H87"', 'unitCode="KGM"')
        expect(falsifie).not.toBe(xml)
        expect(() => verifierExport(falsifie, facture, format)).toThrow()
      }
    }
  })
})
