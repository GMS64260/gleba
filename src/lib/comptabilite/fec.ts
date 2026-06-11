/**
 * Génération du Fichier des Écritures Comptables (FEC).
 *
 * Format normalisé : arrêté du 29/07/2013 (art. L47 A-I LPF).
 *   - 18 colonnes obligatoires
 *   - Séparateur : tabulation
 *   - Encoding : UTF-8 (autorisé depuis 2017 ; ASCII historiquement)
 *   - Dates : AAAAMMJJ
 *   - Décimales : virgule
 *   - Nom du fichier : <SIREN>FECAAAAMMJJ.txt
 *
 * Chaque transaction métier est traduite en écriture en partie double :
 *   - Vente TTC en espèces : Débit Caisse / Crédit Vente HT + Crédit TVA collectée
 *   - Achat TTC à crédit  : Débit Achat HT + Débit TVA déductible / Crédit Fournisseur
 */

import {
  COMPTES_BILAN,
  COMPTES_VENTES,
  COMPTES_ACHATS,
  JOURNAUX,
  compteTresorerie,
  compteVente,
  compteAchat,
} from './plan-comptable-agricole'

const COLS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
] as const

export interface FecLine {
  JournalCode: string
  JournalLib: string
  EcritureNum: string
  EcritureDate: string // AAAAMMJJ
  CompteNum: string
  CompteLib: string
  CompAuxNum: string
  CompAuxLib: string
  PieceRef: string
  PieceDate: string // AAAAMMJJ
  EcritureLib: string
  Debit: string
  Credit: string
  EcritureLet: string
  DateLet: string
  ValidDate: string
  Montantdevise: string
  Idevise: string
}

export interface FecInputVente {
  id: number
  date: Date
  description: string
  categorie: string
  modeReglement: string | null
  numeroPiece: string | null
  tauxTVA: number
  montant: number   // TTC
  montantHT: number | null
  montantTVA: number | null
  clientNom: string | null
  paye: boolean
}

export interface FecInputDepense {
  id: number
  date: Date
  description: string
  categorie: string
  modeReglement: string | null
  numeroPiece: string | null
  tauxTVA: number
  montant: number  // TTC
  montantHT: number | null
  montantTVA: number | null
  fournisseurNom: string | null
  paye: boolean
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function fmtMontant(n: number): string {
  // FEC : virgule décimale, pas de séparateur de milliers
  return n.toFixed(2).replace('.', ',')
}

function ecritureBase(
  journalCode: string,
  num: number,
  date: Date,
  pieceRef: string,
  libelle: string
): Partial<FecLine> {
  return {
    JournalCode: journalCode,
    JournalLib: JOURNAUX[journalCode] || journalCode,
    EcritureNum: String(num).padStart(6, '0'),
    EcritureDate: ymd(date),
    PieceRef: pieceRef,
    PieceDate: ymd(date),
    EcritureLib: libelle.slice(0, 200),
    EcritureLet: '',
    DateLet: '',
    ValidDate: ymd(new Date()),
    Montantdevise: '',
    Idevise: '',
  }
}

function line(base: Partial<FecLine>, compteNum: string, compteLib: string, debit: number, credit: number, tiers?: { num: string; lib: string }): FecLine {
  return {
    JournalCode: base.JournalCode!,
    JournalLib: base.JournalLib!,
    EcritureNum: base.EcritureNum!,
    EcritureDate: base.EcritureDate!,
    CompteNum: compteNum,
    CompteLib: compteLib.slice(0, 200),
    CompAuxNum: tiers?.num || '',
    CompAuxLib: tiers?.lib.slice(0, 200) || '',
    PieceRef: base.PieceRef!,
    PieceDate: base.PieceDate!,
    EcritureLib: base.EcritureLib!,
    Debit: fmtMontant(debit),
    Credit: fmtMontant(credit),
    EcritureLet: base.EcritureLet || '',
    DateLet: base.DateLet || '',
    ValidDate: base.ValidDate!,
    Montantdevise: '',
    Idevise: '',
  }
}

/**
 * Construit les écritures FEC pour la période donnée.
 *
 * Stratégie :
 *  1. Une écriture par VenteManuelle / DepenseManuelle (non auto pour éviter double comptage)
 *  2. Une écriture par Facture émise (statut != annulee, hors avoirs)
 *  3. Une écriture par avoir
 *
 * Les sources brutes auto (élevage, récoltes…) sont déjà répliquées en
 * VenteManuelle auto=true → on les exclut pour ne pas doubler.
 */
export interface FecInputFacture {
  id: number
  numero: string
  type: string // facture | avoir | acompte
  date: Date
  statut: string
  clientId: number | null
  clientNom: string
  totalHT: number
  totalTVA: number
  totalTTC: number
  totauxParTauxTva: Record<string, { ht: number; tva: number; ttc?: number }> | null
  modePaiement: string | null
  // POSTREVIEW — Lignes pour ventiler le compte de produits par catégorie
  // (sinon fallback compte 708000 "autres produits", pas 701100 légumes)
  lignes?: Array<{
    description: string
    categorie?: string | null // 'legumes'|'fruits'|'oeufs'|'viande'|... depuis VenteManuelle ou heuristique
    montantHT: number
    montantTVA: number
    tauxTVA: number
  }>
}

export function genererFec(input: {
  ventes: FecInputVente[]
  depenses: FecInputDepense[]
  factures: FecInputFacture[]
}): FecLine[] {
  const out: FecLine[] = []
  let ecritNum = 1

  // ============ FACTURES ÉMISES ============
  for (const f of input.factures) {
    // Brouillon = numéro provisoire BR-, pas une pièce comptable.
    if (f.statut === 'annulee' || f.statut === 'brouillon') continue
    const isAvoir = f.type === 'avoir'
    const sign = isAvoir ? -1 : 1

    const journal = 'VE'
    const pieceRef = f.numero
    const libelle = `${isAvoir ? 'Avoir' : 'Facture'} ${f.numero}${f.clientNom ? ' — ' + f.clientNom : ''}`
    const base = ecritureBase(journal, ecritNum++, f.date, pieceRef, libelle)

    // POSTREVIEW — Compte auxiliaire client basé sur clientId (et non factureId)
    // pour permettre le lettrage et le suivi de balance âgée.
    // Si clientId est null (client anonyme), on utilise un hash stable du nom
    // pour préserver le regroupement par nom.
    const tiersNum = f.clientId
      ? `411${String(f.clientId).padStart(6, '0').slice(-6)}`
      : `411A${(f.clientNom || 'ANONYME').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase().padEnd(6, 'X')}`
    const tiers = { num: tiersNum, lib: f.clientNom || 'Client anonyme' }

    // Débit client (créance) = TTC * sign
    out.push(line(base, COMPTES_BILAN.clients, 'Créances clients', sign * f.totalTTC, 0, tiers))

    // POSTREVIEW — Compte de produits selon les lignes de facture si disponibles
    // (fallback : 708000 "autres produits" plutôt que 701100 légumes par défaut)
    const lignesCateg = f.lignes || []
    // Map des HT par compte de produit (somme par catégorie sur toutes les lignes)
    const htParCompte = new Map<string, { num: string; lib: string; ht: number; tva: number }>()
    if (lignesCateg.length > 0) {
      for (const l of lignesCateg) {
        const compte = compteVente(l.categorie)
        const key = compte.num
        const tva = l.montantHT > 0 ? (l.montantTVA || 0) : 0
        const ex = htParCompte.get(key)
        if (ex) {
          ex.ht += l.montantHT
          ex.tva += tva
        } else {
          htParCompte.set(key, { num: compte.num, lib: compte.lib, ht: l.montantHT, tva })
        }
      }
      // Émission ligne par compte
      for (const c of htParCompte.values()) {
        if (c.ht !== 0) out.push(line(base, c.num, c.lib, 0, sign * c.ht))
        if (c.tva !== 0) out.push(line(base, COMPTES_BILAN.tvaCollectee, 'TVA collectée', 0, sign * c.tva))
      }
    } else {
      // Fallback (pas de lignes : facture historique pré-14C) → 708000 + ventilation TVA par taux
      const compteFallback = COMPTES_VENTES.autre
      const ventilation = f.totauxParTauxTva && Object.keys(f.totauxParTauxTva).length > 0
        ? Object.entries(f.totauxParTauxTva)
        : ([[String(5.5), { ht: f.totalHT, tva: f.totalTVA }]] as Array<[string, { ht: number; tva: number }]>)
      for (const [, t] of ventilation) {
        if (t.ht !== 0) out.push(line(base, compteFallback.num, compteFallback.lib, 0, sign * t.ht))
        if (t.tva !== 0) out.push(line(base, COMPTES_BILAN.tvaCollectee, 'TVA collectée', 0, sign * t.tva))
      }
    }
  }

  // ============ VENTES MANUELLES (non auto) ============
  for (const v of input.ventes) {
    const journal = v.modeReglement === 'Espèces' ? 'CA' : v.modeReglement === 'À crédit' ? 'VE' : 'BQ'
    const pieceRef = v.numeroPiece || `VM-${v.id}`
    const libelle = `${v.description}${v.clientNom ? ' — ' + v.clientNom : ''}`
    const base = ecritureBase(journal, ecritNum++, v.date, pieceRef, libelle)

    const compteTreso = compteTresorerie(v.modeReglement) || COMPTES_BILAN.clients
    const compteV = compteVente(v.categorie)
    const ht = v.montantHT ?? (v.montant / (1 + v.tauxTVA / 100))
    const tva = v.montantTVA ?? (v.montant - ht)

    // Débit trésorerie (ou client si à crédit) = TTC
    out.push(line(base, compteTreso, compteTreso === COMPTES_BILAN.caisse ? 'Caisse' : compteTreso === COMPTES_BILAN.banque ? 'Banque' : 'Créances clients', v.montant, 0))
    // Crédit vente HT
    if (ht !== 0) out.push(line(base, compteV.num, compteV.lib, 0, ht))
    // Crédit TVA collectée
    if (tva !== 0) out.push(line(base, COMPTES_BILAN.tvaCollectee, 'TVA collectée', 0, tva))
  }

  // ============ DÉPENSES MANUELLES (non auto) ============
  for (const d of input.depenses) {
    const journal = d.modeReglement === 'Espèces' ? 'CA' : d.modeReglement === 'À crédit' ? 'AC' : 'BQ'
    const pieceRef = d.numeroPiece || `DM-${d.id}`
    const libelle = `${d.description}${d.fournisseurNom ? ' — ' + d.fournisseurNom : ''}`
    const base = ecritureBase(journal, ecritNum++, d.date, pieceRef, libelle)

    const compteTreso = compteTresorerie(d.modeReglement) || COMPTES_BILAN.fournisseurs
    const compteA = compteAchat(d.categorie)
    const ht = d.montantHT ?? (d.montant / (1 + d.tauxTVA / 100))
    const tva = d.montantTVA ?? (d.montant - ht)

    // Débit achat HT
    if (ht !== 0) out.push(line(base, compteA.num, compteA.lib, ht, 0))
    // Débit TVA déductible
    if (tva !== 0) out.push(line(base, COMPTES_BILAN.tvaDeductibleBiens, 'TVA déductible', tva, 0))
    // Crédit trésorerie (ou fournisseur si à crédit)
    out.push(line(base, compteTreso, compteTreso === COMPTES_BILAN.caisse ? 'Caisse' : compteTreso === COMPTES_BILAN.banque ? 'Banque' : 'Dettes fournisseurs', 0, d.montant))
  }

  return out
}

/** Sérialise les écritures en TSV FEC (tabulation, UTF-8). */
export function serialiserFec(lines: FecLine[]): string {
  const header = COLS.join('\t')
  const rows = lines.map((l) => COLS.map((c) => l[c]).join('\t'))
  return [header, ...rows].join('\n') + '\n'
}

/** Valide l'équilibre Débit = Crédit par écriture et au global. */
export function validerEquilibre(lines: FecLine[]): {
  equilibre: boolean
  ecart: number
  totalDebit: number
  totalCredit: number
  erreursParEcriture: Array<{ ecriture: string; debit: number; credit: number; ecart: number }>
} {
  const parEcr: Record<string, { debit: number; credit: number }> = {}
  let totalD = 0
  let totalC = 0
  for (const l of lines) {
    const d = parseFloat(l.Debit.replace(',', '.'))
    const c = parseFloat(l.Credit.replace(',', '.'))
    totalD += d
    totalC += c
    if (!parEcr[l.EcritureNum]) parEcr[l.EcritureNum] = { debit: 0, credit: 0 }
    parEcr[l.EcritureNum].debit += d
    parEcr[l.EcritureNum].credit += c
  }
  const erreurs: Array<{ ecriture: string; debit: number; credit: number; ecart: number }> = []
  for (const [num, t] of Object.entries(parEcr)) {
    const ecart = Math.round((t.debit - t.credit) * 100) / 100
    if (Math.abs(ecart) > 0.01) {
      erreurs.push({ ecriture: num, debit: t.debit, credit: t.credit, ecart })
    }
  }
  const globalEcart = Math.round((totalD - totalC) * 100) / 100
  return {
    equilibre: erreurs.length === 0 && Math.abs(globalEcart) <= 0.01,
    ecart: globalEcart,
    totalDebit: Math.round(totalD * 100) / 100,
    totalCredit: Math.round(totalC * 100) / 100,
    erreursParEcriture: erreurs,
  }
}
