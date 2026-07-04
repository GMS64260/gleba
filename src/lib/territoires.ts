/**
 * Territoires français et leurs spécificités d'identité légale et fiscale.
 *
 * - Métropole + DROM (Guadeloupe, Martinique, Guyane, Réunion, Mayotte) :
 *   système SIRENE (SIRET 14 chiffres), euro, fiscalité française (TVA, FEC).
 *   Cas particuliers : Guyane et Mayotte sont hors champ de la TVA (art. 294
 *   du CGI) ; les autres DROM ont des taux de TVA réduits propres.
 * - COM du Pacifique (Nouvelle-Calédonie, Polynésie française, Wallis-et-
 *   Futuna) : identifiant local (RIDET, N° Tahiti), franc Pacifique (XPF) et
 *   fiscalité propre (TGC en Nouvelle-Calédonie, TVA polynésienne…) qui
 *   n'entre PAS dans le format FEC métropolitain.
 * - Autres COM (Saint-Pierre-et-Miquelon, Saint-Barthélemy, Saint-Martin) :
 *   euro, SIRET, fiscalité spécifique le plus souvent sans TVA.
 *
 * Ce module est la source unique de vérité côté identité/territoire. Les
 * écrans, factures, PDF, registres et exports s'y réfèrent au lieu de
 * supposer « France / SIRET / € / TVA ».
 */

import { formatSiret, formatRidet } from './siret'

export type TypeIdentifiant = 'SIRET' | 'RIDET' | 'TAHITI' | 'AUTRE'
export type Devise = 'EUR' | 'XPF'

export interface TerritoireConfig {
  code: string
  label: string
  /** Type d'identifiant légal de l'entreprise sur ce territoire. */
  typeIdentifiant: TypeIdentifiant
  /** Libellé affiché pour l'identifiant (SIRET, RIDET, N° Tahiti…). */
  labelIdentifiant: string
  /** Placeholder de saisie pour l'identifiant. */
  placeholderIdentifiant: string
  devise: Devise
  /** Libellé de la taxe sur les ventes : « TVA » (métropole/DROM/PF) ou « TGC » (NC). */
  libelleTaxe: string
  /** Régimes de taxe proposés à la création pour ce territoire (clés de REGIMES_TVA_TOUS). */
  regimesTva: readonly string[]
  /** Régime de taxe par défaut à la création. */
  regimeTvaDefaut: string
  /** Le FEC (format fiscal métropolitain, arrêté du 29/07/2013) s'applique-t-il ? */
  fecApplicable: boolean
  /** Valeur par défaut du champ libre `pays`. */
  paysDefaut: string
}

/** Ensemble complet des régimes de taxe possibles (tous territoires confondus). */
export const REGIMES_TVA_TOUS = [
  'franchise-293b',
  'reel-simplifie',
  'reel-normal',
  'tgc',
  'non-assujetti',
] as const

export const LABELS_REGIME_TVA: Record<string, string> = {
  'franchise-293b': 'Franchise en base (art. 293 B CGI)',
  'reel-simplifie': 'Réel simplifié',
  'reel-normal': 'Réel normal',
  tgc: 'TGC (Nouvelle-Calédonie)',
  'non-assujetti': 'Non assujetti / exonéré',
}

const SIRET_FIELDS = {
  typeIdentifiant: 'SIRET' as const,
  labelIdentifiant: 'SIRET',
  placeholderIdentifiant: '123 456 789 00012',
}

// Régimes métropole/DROM assujettis à la TVA française.
const REGIMES_FR = ['franchise-293b', 'reel-simplifie', 'reel-normal'] as const
// Régimes des territoires hors champ TVA française (ou à TVA spécifique).
const REGIMES_EXO = ['non-assujetti', 'reel-simplifie', 'reel-normal'] as const

export const TERRITOIRES: Record<string, TerritoireConfig> = {
  METROPOLE: {
    code: 'METROPOLE',
    label: 'France métropolitaine',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    regimesTva: REGIMES_FR,
    regimeTvaDefaut: 'franchise-293b',
    fecApplicable: true,
    paysDefaut: 'France',
  },
  GUADELOUPE: {
    code: 'GUADELOUPE',
    label: 'Guadeloupe (971)',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    regimesTva: REGIMES_FR,
    regimeTvaDefaut: 'franchise-293b',
    fecApplicable: true,
    paysDefaut: 'France',
  },
  MARTINIQUE: {
    code: 'MARTINIQUE',
    label: 'Martinique (972)',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    regimesTva: REGIMES_FR,
    regimeTvaDefaut: 'franchise-293b',
    fecApplicable: true,
    paysDefaut: 'France',
  },
  GUYANE: {
    code: 'GUYANE',
    label: 'Guyane (973)',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    // TVA non applicable en Guyane (art. 294 CGI).
    regimesTva: REGIMES_EXO,
    regimeTvaDefaut: 'non-assujetti',
    fecApplicable: true,
    paysDefaut: 'France',
  },
  REUNION: {
    code: 'REUNION',
    label: 'La Réunion (974)',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    regimesTva: REGIMES_FR,
    regimeTvaDefaut: 'franchise-293b',
    fecApplicable: true,
    paysDefaut: 'France',
  },
  MAYOTTE: {
    code: 'MAYOTTE',
    label: 'Mayotte (976)',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    // TVA non applicable à Mayotte (art. 294 CGI).
    regimesTva: REGIMES_EXO,
    regimeTvaDefaut: 'non-assujetti',
    fecApplicable: true,
    paysDefaut: 'France',
  },
  NOUVELLE_CALEDONIE: {
    code: 'NOUVELLE_CALEDONIE',
    label: 'Nouvelle-Calédonie (988)',
    typeIdentifiant: 'RIDET',
    labelIdentifiant: 'RIDET',
    placeholderIdentifiant: '0858878.004',
    devise: 'XPF',
    libelleTaxe: 'TGC',
    regimesTva: ['non-assujetti', 'tgc'],
    regimeTvaDefaut: 'non-assujetti',
    fecApplicable: false,
    paysDefaut: 'Nouvelle-Calédonie',
  },
  POLYNESIE: {
    code: 'POLYNESIE',
    label: 'Polynésie française (987)',
    typeIdentifiant: 'TAHITI',
    labelIdentifiant: 'N° Tahiti',
    placeholderIdentifiant: '123456',
    devise: 'XPF',
    libelleTaxe: 'TVA',
    regimesTva: REGIMES_EXO,
    regimeTvaDefaut: 'non-assujetti',
    fecApplicable: false,
    paysDefaut: 'Polynésie française',
  },
  WALLIS_FUTUNA: {
    code: 'WALLIS_FUTUNA',
    label: 'Wallis-et-Futuna (986)',
    typeIdentifiant: 'AUTRE',
    labelIdentifiant: 'Identifiant',
    placeholderIdentifiant: '',
    devise: 'XPF',
    libelleTaxe: 'TVA',
    regimesTva: ['non-assujetti'],
    regimeTvaDefaut: 'non-assujetti',
    fecApplicable: false,
    paysDefaut: 'Wallis-et-Futuna',
  },
  SAINT_PIERRE_MIQUELON: {
    code: 'SAINT_PIERRE_MIQUELON',
    label: 'Saint-Pierre-et-Miquelon (975)',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    regimesTva: ['non-assujetti'],
    regimeTvaDefaut: 'non-assujetti',
    fecApplicable: false,
    paysDefaut: 'Saint-Pierre-et-Miquelon',
  },
  SAINT_BARTHELEMY: {
    code: 'SAINT_BARTHELEMY',
    label: 'Saint-Barthélemy (977)',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    regimesTva: ['non-assujetti'],
    regimeTvaDefaut: 'non-assujetti',
    fecApplicable: false,
    paysDefaut: 'Saint-Barthélemy',
  },
  SAINT_MARTIN: {
    code: 'SAINT_MARTIN',
    label: 'Saint-Martin (978)',
    ...SIRET_FIELDS,
    devise: 'EUR',
    libelleTaxe: 'TVA',
    regimesTva: REGIMES_FR,
    regimeTvaDefaut: 'franchise-293b',
    fecApplicable: false,
    paysDefaut: 'Saint-Martin',
  },
  ETRANGER: {
    code: 'ETRANGER',
    label: 'Étranger / autre',
    typeIdentifiant: 'AUTRE',
    labelIdentifiant: 'Identifiant légal',
    placeholderIdentifiant: '',
    devise: 'EUR',
    libelleTaxe: 'TVA',
    regimesTva: ['non-assujetti', 'reel-normal'],
    regimeTvaDefaut: 'non-assujetti',
    fecApplicable: false,
    paysDefaut: '',
  },
}

/** Codes de territoires, pour les <select> (ordre d'affichage). */
export const CODES_TERRITOIRES = Object.keys(TERRITOIRES)

/** Récupère la config d'un territoire, avec repli sur la métropole. */
export function getTerritoire(code?: string | null): TerritoireConfig {
  return (code && TERRITOIRES[code]) || TERRITOIRES.METROPOLE
}

/** Devise d'un territoire (EUR par défaut). */
export function deviseDuTerritoire(code?: string | null): Devise {
  return getTerritoire(code).devise
}

/**
 * Une facture est-elle émise sans taxe (TVA/TGC) à 0 ?
 * Vrai pour la franchise en base (art. 293 B) et les non-assujettis/exonérés.
 */
export function factureSansTaxe(regimeTva?: string | null): boolean {
  return regimeTva === 'franchise-293b' || regimeTva === 'non-assujetti'
}

/**
 * L'exploitation collecte-t-elle de la TVA française déclarable en CA3 ?
 * SEULS les régimes réels (simplifié / normal) sont concernés. La franchise
 * en base (293 B), les non-assujettis (DROM, art. 294) et la TGC (Nouvelle-
 * Calédonie / Polynésie) sont hors champ de la CA3 : aucune TVA à payer.
 * (Audit 2026-07 : l'écran TVA affichait une "TVA à payer" fictive pour
 * non-assujetti et tgc — seule la franchise 293 B était neutralisée.)
 */
export function collecteTvaFrancaise(regimeTva?: string | null): boolean {
  return regimeTva === 'reel-simplifie' || regimeTva === 'reel-normal'
}

/**
 * Message d'explication à afficher quand la CA3 est neutralisée (toutes cases
 * à zéro), selon le motif d'exonération. `null` pour un régime réel.
 */
export function motifHorsChampCa3(regimeTva?: string | null): string | null {
  if (regimeTva === 'franchise-293b')
    return 'Exploitation en franchise en base (art. 293 B CGI) : vous ne collectez ni ne déduisez aucune TVA — la déclaration CA3 ne vous concerne pas.'
  if (regimeTva === 'non-assujetti')
    return 'Exploitation non assujettie à la TVA (art. 294 CGI, DROM) : la déclaration CA3 ne vous concerne pas.'
  if (regimeTva === 'tgc')
    return 'Exploitation soumise à la TGC (Nouvelle-Calédonie / Polynésie), hors champ de la TVA française : la CA3 ne vous concerne pas.'
  return null
}

/**
 * Mention fiscale à reporter en pied de facture selon le régime.
 * `null` si aucune mention spécifique n'est requise (régimes réels).
 */
export function mentionFiscale(regimeTva?: string | null): string | null {
  if (regimeTva === 'franchise-293b') return 'TVA non applicable, art. 293 B du CGI'
  if (regimeTva === 'non-assujetti') return 'TVA non applicable'
  return null
}

/**
 * Identifiant légal affichable d'une exploitation (label + valeur formatée),
 * en tenant compte du territoire. `null` si aucun identifiant n'est renseigné.
 */
export function identifiantLegalAffichage(exploitation: {
  territoire?: string | null
  siret?: string | null
  identifiantLegal?: string | null
}): { label: string; valeur: string } | null {
  const terr = getTerritoire(exploitation.territoire)
  let valeur: string | null = null
  if (terr.typeIdentifiant === 'SIRET') {
    valeur = exploitation.siret ? formatSiret(exploitation.siret) : null
  } else if (terr.typeIdentifiant === 'RIDET') {
    valeur = exploitation.identifiantLegal ? formatRidet(exploitation.identifiantLegal) : null
  } else {
    valeur = exploitation.identifiantLegal || null
  }
  if (!valeur) return null
  return { label: terr.labelIdentifiant, valeur }
}
