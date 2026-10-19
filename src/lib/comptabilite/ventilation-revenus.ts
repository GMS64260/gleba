/**
 * Ventilation des revenus par module, calculée sur les MÊMES écritures que le
 * total comptable (`getKpiCompta`, src/lib/kpi/compta.ts) : les ventes
 * (`VenteManuelle` : saisies, miroirs automatiques des modules, ventes
 * boutique) et les factures émises ou payées, avoirs déduits.
 *
 * Ticket cmvflua2x (QA 2026-10-19) : le Compte de résultat ventilait les
 * revenus en relisant les tables métier brutes (ventes d'élevage, récoltes,
 * bois…) pendant que la carte Revenus additionnait ventes et factures. Une
 * facture saisie dans Factures sans vente métier n'entrait dans aucun module,
 * un avoir non plus, et une vente datée après le jour entrait dans les modules
 * sans entrer dans le total : un écart que le bandeau ne savait pas expliquer.
 * Les modules se calculent désormais sur les lignes du total, si bien que
 * leur somme EST le total, au centime.
 */

import { MODULES_COMPTA, bucketModuleCompta, ventilationVide, type ModuleCompta } from './modules'

/** Une vente comptée au total des revenus (une ligne `VenteManuelle`). */
export interface VenteAVentiler {
  montant: number
  module?: string | null
  categorie?: string | null
}

/** Ventes métier portées par une facture (comptes de ses relations). */
export interface VentesPorteesParFacture {
  ventesProduits?: number
  abattages?: number
  recoltesArbres?: number
  productionsBois?: number
  /** Récoltes du potager (`Recolte.factureId`, sans relation Prisma). */
  recoltes?: number
  commandesBoutique?: number
}

/** Une facture comptée au total des revenus. */
export interface FactureAVentiler {
  type: string
  totalTTC: number
  /**
   * Module de la vente métier que la facture porte ; pour un avoir, celui de
   * sa facture d'origine. `null` : facture saisie à la main, sans vente.
   */
  moduleSource: ModuleCompta | null
}

/** D'où vient le total : la somme des quatre rubriques est le total. */
export interface CompositionRevenus {
  /** Ventes saisies, miroirs automatiques et ventes boutique. */
  ventes: number
  /** Factures portant une vente métier (élevage, verger, potager, boutique). */
  facturesRattachees: number
  /** Factures saisies dans Factures sans vente métier : rangées en « Autre ». */
  facturesSansVente: number
  /** Avoirs (négatifs), déduits du module de leur facture d'origine. */
  avoirs: number
}

export interface VentilationRevenus {
  /** Total des revenus, au centime. */
  total: number
  /** Revenus par module ; leur somme est exactement `total`. */
  parModule: Record<ModuleCompta, number>
  composition: CompositionRevenus
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Module d'une vente : son module métier quand il est connu ; sinon (boutique,
 * « general », ancienne saisie sans module) les légumes vont au maraîchage et
 * le reste en « Autre », comme le faisait la ventilation précédente.
 */
export function moduleDeVente(vente: Pick<VenteAVentiler, 'module' | 'categorie'>): ModuleCompta {
  const module = bucketModuleCompta(vente.module)
  if (module !== 'autre') return module
  return (vente.categorie ?? '').trim().toLowerCase() === 'legumes' ? 'potager' : 'autre'
}

/** Module de la vente métier portée par une facture, `null` si elle n'en porte aucune. */
export function moduleDesVentesPortees(ventes: VentesPorteesParFacture): ModuleCompta | null {
  if ((ventes.ventesProduits ?? 0) > 0 || (ventes.abattages ?? 0) > 0) return 'elevage'
  if ((ventes.recoltesArbres ?? 0) > 0 || (ventes.productionsBois ?? 0) > 0) return 'verger'
  if ((ventes.recoltes ?? 0) > 0) return 'potager'
  if ((ventes.commandesBoutique ?? 0) > 0) return bucketModuleCompta('boutique')
  return null
}

/**
 * Arrondit chaque poste au centime en reportant le reste d'arrondi sur le
 * poste le plus fort : la somme des postes affichés égale le total arrondi.
 */
function arrondirEnConservantLeTotal<K extends string>(valeurs: Record<K, number>, cles: readonly K[], total: number): Record<K, number> {
  const out = {} as Record<K, number>
  for (const k of cles) out[k] = round2(valeurs[k])
  const reste = round2(total - cles.reduce((s, k) => s + out[k], 0))
  if (reste !== 0 && cles.length > 0) {
    const plusFort = cles.reduce((a, b) => (Math.abs(valeurs[b]) > Math.abs(valeurs[a]) ? b : a))
    out[plusFort] = round2(out[plusFort] + reste)
  }
  return out
}

const RUBRIQUES = ['ventes', 'facturesRattachees', 'facturesSansVente', 'avoirs'] as const

/**
 * Ventile les revenus par module. Invariant : Σ `parModule` = Σ `composition`
 * = `total` = Σ ventes + Σ factures − Σ avoirs (au centime).
 */
export function ventilerRevenus(ventes: readonly VenteAVentiler[], factures: readonly FactureAVentiler[]): VentilationRevenus {
  const parModule = ventilationVide()
  const composition: CompositionRevenus = { ventes: 0, facturesRattachees: 0, facturesSansVente: 0, avoirs: 0 }

  for (const v of ventes) {
    const montant = Number(v.montant) || 0
    parModule[moduleDeVente(v)] += montant
    composition.ventes += montant
  }
  for (const f of factures) {
    const estAvoir = f.type === 'avoir'
    const montant = (estAvoir ? -1 : 1) * (Number(f.totalTTC) || 0)
    parModule[f.moduleSource ?? 'autre'] += montant
    if (estAvoir) composition.avoirs += montant
    else if (f.moduleSource) composition.facturesRattachees += montant
    else composition.facturesSansVente += montant
  }

  const total = round2(MODULES_COMPTA.reduce((s, k) => s + parModule[k], 0))
  return {
    total,
    parModule: arrondirEnConservantLeTotal(parModule, MODULES_COMPTA, total),
    composition: arrondirEnConservantLeTotal(composition, RUBRIQUES, total),
  }
}
