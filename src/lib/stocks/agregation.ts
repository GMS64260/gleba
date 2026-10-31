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
  valeurParModule: { potager: number; verger: number; elevage: number; autre?: number }
  itemsParModule: { potager: number; verger: number; elevage: number; autre?: number }
}

/**
 * Sélecteur d'agrégation des valeurs stocks. Ignore les `valeur` null
 * (article non valorisable) mais inclut tout le reste, y compris zéro.
 * Calcule simultanément le breakdown par module pour la card UI.
 */
export function computeStocksTotaux(stocks: StockItem[]): StocksTotaux {
  let total = 0
  const parModule: Record<string, number> = { potager: 0, verger: 0, elevage: 0, autre: 0 }
  const items: Record<string, number> = { potager: 0, verger: 0, elevage: 0, autre: 0 }
  for (const s of stocks) {
    const cle = s.module in items ? s.module : 'autre'
    items[cle]++
    if (s.valeur != null && Number.isFinite(s.valeur)) {
      total += s.valeur
      parModule[cle] += s.valeur
    }
  }
  return {
    valeurTotale: round2(total),
    valeurParModule: {
      potager: round2(parModule.potager),
      verger: round2(parModule.verger),
      elevage: round2(parModule.elevage),
      ...(items.autre ? { autre: round2(parModule.autre) } : {}),
    },
    itemsParModule: {
      potager: items.potager,
      verger: items.verger,
      elevage: items.elevage,
      ...(items.autre ? { autre: items.autre } : {}),
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

/**
 * Arrondi d'affichage d'une quantité de stock.
 *
 * QA cmsqlr6jb : `4.8 + 4.8 + 0.5 + 0.7` vaut `10.799999999999999` en flottant,
 * et ce nombre est parti tel quel à l'utilisateur sur /comptabilite/stocks.
 * Même raison que `surfacePlanche()`. Trois décimales = le gramme sur un kilo,
 * le millilitre sur un litre : assez fin pour ne rien perdre, assez court pour
 * ne plus laisser passer la bavure.
 */
export function arrondiQuantiteStock(q: number): number {
  return Number.isFinite(q) ? Math.round(q * 1000) / 1000 : 0
}
