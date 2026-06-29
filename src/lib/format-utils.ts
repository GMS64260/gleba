/**
 * Helpers de formatage sémantique pour les montants, pourcentages et stocks.
 * Retournent une valeur formatée + une classe Tailwind cohérente avec le signe
 * (vert positif / rouge négatif / neutre).
 *
 * Usage typique:
 *   const { value, className } = formatEuroSemantic(stats.marge)
 *   <p className={`text-3xl font-bold ${className}`}>{value}</p>
 */

import type { Devise } from "./territoires"

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
})

const xpfFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })

/** Symbole court de la devise (€, ou F pour le franc Pacifique XPF). */
export function symboleDevise(devise: Devise = "EUR"): string {
  return devise === "XPF" ? "F" : "€"
}

/**
 * Formate un montant dans la devise de l'exploitation.
 * - EUR : « 1 234,56 € »
 * - XPF : « 1 235 F » (franc Pacifique, sans décimales)
 */
export function formatMontantDevise(montant: number, devise: Devise = "EUR"): string {
  const safe = Number.isFinite(montant) ? montant : 0
  if (devise === "XPF") {
    return `${xpfFormatter.format(Math.round(safe))} F`
  }
  return euroFormatter.format(safe)
}

/**
 * Formate un montant en euros avec classe sémantique selon le signe.
 * - >= 0  -> text-emerald-600 (positif)
 * - <  0  -> text-red-600 (négatif)
 * - == 0  -> text-slate-700 (neutre)
 */
export function formatEuroSemantic(montant: number): {
  value: string
  className: string
} {
  const safe = Number.isFinite(montant) ? montant : 0
  const value = euroFormatter.format(safe)
  let className = "text-slate-700"
  if (safe > 0) className = "text-emerald-600"
  else if (safe < 0) className = "text-red-600"
  return { value, className }
}

/**
 * Formate un pourcentage avec classe sémantique selon le signe.
 * Le parametre est attendu en pourcentage (ex: 12 pour 12 %).
 */
export function formatPercentSemantic(pct: number): {
  value: string
  className: string
} {
  const safe = Number.isFinite(pct) ? pct : 0
  const rounded = Math.round(safe * 10) / 10
  const value = `${rounded > 0 ? "+" : ""}${rounded}%`
  let className = "text-slate-700"
  if (safe > 0) className = "text-emerald-600"
  else if (safe < 0) className = "text-red-600"
  return { value, className }
}

/**
 * Formate un stock avec alerte visuelle.
 * - stock <= 0           -> text-red-600 font-bold, alert=true (impossible métier-ment)
 * - stock < seuilMin     -> text-amber-600 (stock bas)
 * - stock >= seuilMin    -> text-slate-700 (normal)
 */
export function formatStockSemantic(
  stock: number,
  seuilMin?: number
): { value: string; className: string; alert: boolean } {
  const safe = Number.isFinite(stock) ? stock : 0
  let className = "text-slate-700"
  let alert = false
  if (safe <= 0) {
    className = "text-red-600 font-bold"
    alert = true
  } else if (seuilMin !== undefined && seuilMin !== null && safe < seuilMin) {
    className = "text-amber-600"
  }
  return { value: safe.toString(), className, alert }
}
