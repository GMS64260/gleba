import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ operations: vi.fn(), virements: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  default: {
    exploitation: { findUnique: async () => ({ devise: 'EUR', territoire: null }) },
    reglement: { findMany: async () => [], count: async () => 0 },
    facture: { findMany: async () => [] },
    operationBancaire: { findMany: mocks.operations },
    virementBancaire: { findMany: mocks.virements },
  },
}))
import { genererFec, validerEquilibre, type FecInputVente, type FecInputReglement } from '../fec'
import { chargerFecReglements } from './fec-reglements'

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

/**
 * Revue du 2026-10-29 : les versements Stripe entraient au FEC même exclus, et
 * même quand les ventes, pointées « payé / CB », étaient déjà en 512.
 */
describe('versements Stripe au FEC', () => {
  const debut = new Date('2026-01-01'),
    fin = new Date('2026-12-31T23:59:59Z')
  const compte = (id: string, stripe: boolean) => ({ id, nom: id, devise: 'EUR', connexionStripeId: stripe ? 'cx-' + id : null })
  const op = (id: string, c: ReturnType<typeof compte>, brut: number, famille: string, statut = 'comptabilisee') => ({
    id, compteId: c.id, compte: c, brutCentimes: BigInt(brut), montantCentimes: BigInt(brut), famille, statut,
    aVerifier: false, referenceExterne: 'ref-' + id, date: new Date('2026-05-10'),
  })
  const rapproche = compte('stripe-rapproche', true),
    direct = compte('stripe-direct', true),
    banque = compte('banque', false)
  // Encaissements : rapprochés en entier sur le premier compte, jamais sur le second.
  const commerciaux = [
    { compteId: rapproche.id, brutCentimes: BigInt(10000), reglements: [{ montantCentimes: BigInt(6000) }, { montantCentimes: BigInt(4000) }] },
    { compteId: direct.id, brutCentimes: BigInt(5000), reglements: [] },
  ]
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.operations.mockImplementation(async (q: { where: { famille: { in?: string[]; notIn?: string[] }; compteId?: { in: string[] } } }) =>
      q.where.famille.in
        ? [op('po-rapproche', rapproche, -9700, 'payout'), op('po-direct', direct, -5000, 'payout')]
        : commerciaux.filter((o) => q.where.compteId?.in.includes(o.compteId)))
    mocks.virements.mockResolvedValue([
      { operationSortie: op('po-direct', direct, -5000, 'payout'), operationEntree: op('releve-direct', banque, 5000, 'releve'),
        operationSortieId: 'po-direct', operationEntreeId: 'releve-direct' },
      { operationSortie: op('po-rapproche', rapproche, -9700, 'payout'), operationEntree: op('releve-rapproche', banque, 9700, 'releve'),
        operationSortieId: 'po-rapproche', operationEntreeId: 'releve-rapproche' },
    ])
  })

  it('ne lit que les versements comptabilisés, pas ceux exclus ou en attente', async () => {
    await chargerFecReglements('u1', debut, fin)
    const versements = mocks.operations.mock.calls.find(([q]) => q.where.famille.in)![0]
    expect(versements.where.statut).toBe('comptabilisee')
  })

  it('n’exporte que les versements d’un compte dont les encaissements passent par 511500', async () => {
    const journal = await chargerFecReglements('u1', debut, fin)
    expect(journal.mouvementsInternes.map((m) => m.id).sort()).toEqual(['po-rapproche', 'releve-rapproche'])
    // Ferme qui pointe ses ventes « payé / CB » : 512 n'est débité qu'une fois, 511500 reste à zéro.
    const banque512 = (lignes: ReturnType<typeof genererFec>) =>
      Math.round(lignes.filter((l) => l.CompteNum.startsWith('512')).reduce((n, l) => n + valeur(l.Debit) - valeur(l.Credit), 0) * 100) / 100
    const lignes = genererFec({
      ventes: [{ ...vente, id: 2, montant: 50, montantHT: 50, montantTVA: 0, tauxTVA: 0, paye: true, reglementDetaille: false }],
      depenses: [],
      factures: [],
      ...journal,
      mouvementsInternes: journal.mouvementsInternes.filter((m) => m.id.endsWith('direct')),
      exercice: 2026,
    })
    expect(banque512(lignes)).toBe(50)
    expect(solde(lignes, '511500')).toBe(0)
    expect(validerEquilibre(lignes).equilibre).toBe(true)
  })

  it('écarte aussi un compte dont un seul encaissement reste à rapprocher, ou sans encaissement', async () => {
    commerciaux[0].reglements = [{ montantCentimes: BigInt(6000) }]
    expect((await chargerFecReglements('u1', debut, fin)).mouvementsInternes).toEqual([])
    commerciaux[0].reglements = [{ montantCentimes: BigInt(10000) }]
    mocks.operations.mockImplementation(async (q: { where: { famille: { in?: string[] } } }) =>
      q.where.famille.in ? [op('po-seul', compte('stripe-vide', true), -100, 'payout')] : [])
    mocks.virements.mockResolvedValue([])
    expect((await chargerFecReglements('u1', debut, fin)).mouvementsInternes).toEqual([])
  })

  it('n’exporte pas un virement dont un côté est exclu', async () => {
    mocks.virements.mockResolvedValue([
      { operationSortie: op('sortie', banque, -300, 'releve'), operationEntree: op('entree', compte('banque-2', false), 300, 'releve', 'ignoree'),
        operationSortieId: 'sortie', operationEntreeId: 'entree' },
    ])
    expect((await chargerFecReglements('u1', debut, fin)).mouvementsInternes.map((m) => m.id)).toEqual(['po-rapproche'])
  })
})
