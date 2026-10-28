import { describe, expect, it } from 'vitest'
import { genererFec, validerEquilibre, type FecInputVente, type FecInputReglement } from '../fec'

const vente: FecInputVente = {
  id: 1,
  date: new Date('2026-01-02'),
  description: 'Vente fictive',
  categorie: 'oeufs',
  modeReglement: 'CB',
  numeroPiece: 'V-QA',
  tauxTVA: 20,
  montant: 120,
  montantHT: 100,
  montantTVA: 20,
  clientNom: 'Client fictif',
  paye: false,
  reglementDetaille: true,
}
const reglement: FecInputReglement = {
  id: 'r-qa',
  date: new Date('2026-02-03'),
  montant: 40,
  sens: 'encaissement',
  modeReglement: 'CB',
  piece: 'CB-QA',
  libelle: 'Vente fictive',
  annuleLe: null,
  compteTresorerie: { num: '511500', lib: 'Stripe fictif' },
}
const valeur = (v: string) => Number(v.replace(',', '.'))
const solde = (lignes: ReturnType<typeof genererFec>, compte: string) =>
  Math.round(
    lignes
      .filter((l) => l.CompteNum === compte)
      .reduce((n, l) => n + valeur(l.Debit) - valeur(l.Credit), 0) * 100,
  ) / 100

describe('trésorerie des règlements détaillés au FEC', () => {
  it('garde une seule vente et une seule TVA, avec une créance partiellement soldée', () => {
    const lignes = genererFec({
      ventes: [vente],
      depenses: [],
      factures: [],
      reglements: [reglement],
      exercice: 2026,
    })
    expect(validerEquilibre(lignes).equilibre).toBe(true)
    expect(solde(lignes, '411000')).toBe(80)
    expect(solde(lignes, '511500')).toBe(40)
    expect(solde(lignes, '445700')).toBe(-20)
    expect(lignes.filter((l) => l.JournalCode === 'VE')).toHaveLength(3)
    expect(lignes.filter((l) => l.JournalCode === 'BQ')).toHaveLength(2)
  })
  it('inverse un remboursement sans montant négatif ni nouvelle charge', () => {
    const lignes = genererFec({
      ventes: [],
      depenses: [],
      factures: [],
      reglements: [reglement, { ...reglement, id: 'refund', montant: -10 }],
      exercice: 2026,
    })
    expect(solde(lignes, '511500')).toBe(30)
    expect(lignes.every((l) => valeur(l.Debit) >= 0 && valeur(l.Credit) >= 0)).toBe(true)
    expect(validerEquilibre(lignes).equilibre).toBe(true)
  })
  it('extourne une saisie dans son exercice de correction', () => {
    const r = { ...reglement, date: new Date('2025-12-15'), annuleLe: new Date('2026-01-15') }
    const lignes = genererFec({
      ventes: [],
      depenses: [],
      factures: [],
      reglements: [r],
      exercice: 2026,
    })
    expect(lignes).toHaveLength(2)
    expect(solde(lignes, '511500')).toBe(-40)
    expect(lignes.every((l) => l.EcritureDate === '20260115')).toBe(true)
  })
  it('solde les deux côtés d’un virement par 580 sans produit ni charge', () => {
    const lignes = genererFec({
      ventes: [],
      depenses: [],
      factures: [],
      mouvementsInternes: [
        {
          id: 'sortie',
          date: new Date('2026-02-03'),
          montant: 97,
          sens: 'sortie',
          piece: 'po-qa',
          compteTresorerie: { num: '511500', lib: 'Stripe' },
        },
        {
          id: 'entree',
          date: new Date('2026-02-04'),
          montant: 97,
          sens: 'entree',
          piece: 'bank-qa',
          compteTresorerie: { num: '512000', lib: 'Banque' },
        },
      ],
    })
    expect(validerEquilibre(lignes).equilibre).toBe(true)
    expect(solde(lignes, '580000')).toBe(0)
    expect(solde(lignes, '511500')).toBe(-97)
    expect(solde(lignes, '512000')).toBe(97)
    expect(lignes.some((l) => /^[67]/.test(l.CompteNum))).toBe(false)
  })
})
