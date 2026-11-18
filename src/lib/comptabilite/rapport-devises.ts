import type { Devise } from '@/lib/territoires'
import { estPresent, type TotalDevise } from './totaux-devise'

/*
 * Rapports (compte de résultat) lus devise par devise, depuis la réponse de
 * GET /api/comptabilite/stats (lot devise-totaux-api, tour 2) : un groupe par
 * devise présente, jamais de somme EUR + XPF, jamais `null` converti en zéro.
 */

export const MODULES_RAPPORT = ['potager', 'verger', 'elevage', 'autre'] as const
export type ModuleRapport = (typeof MODULES_RAPPORT)[number]
export type MontantsModules = Record<ModuleRapport, number>

export interface CompositionRevenus { ventes: number; facturesRattachees: number; facturesSansVente: number; avoirs: number }

/** Champs de GET stats lus par Rapports (historiques nullables et voisins par devise). */
export interface StatsRapport {
  revenus: number | null
  depenses: number | null
  benefice: number | null
  revenusParModule: Record<ModuleRapport, number | null>
  depensesParModule: Record<ModuleRapport, number | null>
  revenusParDevise?: TotalDevise[]
  depensesParDevise?: TotalDevise[]
  revenusParModuleParDevise?: Array<TotalDevise & { parModule: MontantsModules; composition?: CompositionRevenus }>
  depensesParModuleParDevise?: Array<TotalDevise & { parModule: MontantsModules }>
  coherenceCheck?: { revenusComposition?: CompositionRevenus | null } | null
}

export interface GroupeRapport {
  monnaie: Devise | null
  revenus: number
  depenses: number
  benefice: number
  revenusParModule: MontantsModules
  depensesParModule: MontantsModules
  composition: CompositionRevenus | null
}

const zeros = (): MontantsModules => ({ potager: 0, verger: 0, elevage: 0, autre: 0 })
const auCentime = (n: number) => Math.round(n * 100) / 100
const rang = (m: Devise | null) => (m === 'EUR' ? 0 : m === 'XPF' ? 1 : 2)

/**
 * Un groupe par devise présente (revenus, charges ou ventilation analytique) ;
 * ordre EUR, XPF, inconnue. Sans voisins par devise (ancienne réponse), un seul
 * groupe dans la devise courante, à partir des totaux historiques non nuls ;
 * des totaux nuls sans voisins ne rendent aucun groupe (rien à afficher plutôt
 * qu'un zéro inventé).
 */
export function groupesRapport(stats: StatsRapport, deviseCourante: Devise | null): GroupeRapport[] {
  if (!stats.revenusParDevise || !stats.depensesParDevise) {
    if (stats.revenus === null || stats.depenses === null || stats.benefice === null) return []
    const modules = (m: Record<ModuleRapport, number | null>) => {
      const r = zeros()
      for (const k of MODULES_RAPPORT) r[k] = m[k] ?? 0
      return r
    }
    if (MODULES_RAPPORT.some((k) => stats.revenusParModule[k] === null || stats.depensesParModule[k] === null)) return []
    return [{
      monnaie: deviseCourante,
      revenus: stats.revenus,
      depenses: stats.depenses,
      benefice: stats.benefice,
      revenusParModule: modules(stats.revenusParModule),
      depensesParModule: modules(stats.depensesParModule),
      composition: stats.coherenceCheck?.revenusComposition ?? null,
    }]
  }
  const revParModule = stats.revenusParModuleParDevise ?? []
  const depParModule = stats.depensesParModuleParDevise ?? []
  const devises = new Set<Devise | null>(
    [...stats.revenusParDevise, ...stats.depensesParDevise, ...revParModule, ...depParModule].filter(estPresent).map((t) => t.monnaie),
  )
  if (devises.size === 0) devises.add(stats.revenusParDevise[0]?.monnaie ?? deviseCourante)
  return [...devises].sort((a, b) => rang(a) - rang(b)).map((monnaie) => {
    const revenus = stats.revenusParDevise!.find((t) => t.monnaie === monnaie)?.total ?? 0
    const depenses = stats.depensesParDevise!.find((t) => t.monnaie === monnaie)?.total ?? 0
    const rev = revParModule.find((g) => g.monnaie === monnaie)
    return {
      monnaie,
      revenus,
      depenses,
      benefice: auCentime(revenus - depenses),
      revenusParModule: rev?.parModule ?? zeros(),
      depensesParModule: depParModule.find((g) => g.monnaie === monnaie)?.parModule ?? zeros(),
      composition: rev?.composition ?? null,
    }
  })
}

/** Libellé de devise d'une ligne d'export (« EUR », « XPF », « inconnue »). */
export function libelleDevise(monnaie: Devise | null | undefined): string {
  return monnaie === 'EUR' || monnaie === 'XPF' ? monnaie : 'inconnue'
}
