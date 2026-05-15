/**
 * BUG #7 (QA Camille 2026-05-15) — la card « Valeur estimée » affichait
 * 0,00 € alors que la liste contenait des articles valorisables. Causes :
 *  - de nombreux items avaient `valeur: null` hardcodé (animaux, lots,
 *    arbres, œufs) ; aucune valorisation par prix moyen.
 *  - les récoltes/fruits sans prix saisi tombaient à 0 sans fallback.
 *
 * Ce module rassemble :
 *  - `computeStocksTotaux()` : sélecteur d'agrégation testable (total +
 *    breakdown par module).
 *  - `moyennePrix()` : utilitaire pour calculer un prix de référence
 *    depuis les dernières ventes.
 */

export interface StockItem {
  id: string
  module: string
  categorie: string
  nom: string
  stock: number
  unite: string
  stockMin: number | null
  alerteBas: boolean
  valeur: number | null
}

export interface StocksTotaux {
  valeurTotale: number
  valeurParModule: { potager: number; verger: number; elevage: number }
  itemsParModule: { potager: number; verger: number; elevage: number }
}

/**
 * Sélecteur d'agrégation des valeurs stocks. Ignore les `valeur` null
 * (article non valorisable) mais inclut tout le reste, y compris zéro.
 * Calcule simultanément le breakdown par module pour la card UI.
 */
export function computeStocksTotaux(stocks: StockItem[]): StocksTotaux {
  let total = 0
  const parModule: Record<string, number> = { potager: 0, verger: 0, elevage: 0 }
  const items: Record<string, number> = { potager: 0, verger: 0, elevage: 0 }
  for (const s of stocks) {
    if (s.module in items) items[s.module]++
    if (s.valeur != null && Number.isFinite(s.valeur)) {
      total += s.valeur
      if (s.module in parModule) parModule[s.module] += s.valeur
    }
  }
  return {
    valeurTotale: round2(total),
    valeurParModule: {
      potager: round2(parModule.potager),
      verger: round2(parModule.verger),
      elevage: round2(parModule.elevage),
    },
    itemsParModule: {
      potager: items.potager,
      verger: items.verger,
      elevage: items.elevage,
    },
  }
}

/**
 * Moyenne des prix d'une série de ventes (filtre les nuls / négatifs /
 * non finis). Retourne null si aucun prix exploitable.
 */
export function moyennePrix(prix: (number | null | undefined)[]): number | null {
  const valides = prix.filter(
    (p): p is number => typeof p === 'number' && p > 0 && Number.isFinite(p)
  )
  if (valides.length === 0) return null
  return round2(valides.reduce((s, p) => s + p, 0) / valides.length)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
