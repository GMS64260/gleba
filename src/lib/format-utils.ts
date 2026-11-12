/**
 * Helpers de formatage partagés : nombres, montants dans la devise de
 * l'exploitation, date du jour locale.
 */

import type { Devise } from "./territoires"

/** Nombre en français (« 11 666 », « 29,9 ») ; partagé par les écrans et le moteur d'arrosage. */
export function formatNombre(valeur: number, decimales = 0): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimales }).format(valeur)
}

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
 * Date du jour au format "YYYY-MM-DD" dans le fuseau LOCAL de l'utilisateur.
 *
 * À utiliser pour toute valeur par défaut de champ <input type="date">.
 * `new Date().toISOString().split('T')[0]` donnait le jour UTC : décalé d'un
 * jour en soirée pour l'Europe (UTC+1/+2) et une bonne partie de la journée en
 * Outre-mer (UTC+11 en Nouvelle-Calédonie, UTC-10 en Polynésie…) — la date
 * pré-remplie tombait la veille ou le lendemain (audit 2026-07, #44/#45/#49).
 */
export function todayLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
