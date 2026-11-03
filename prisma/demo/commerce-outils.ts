/**
 * Outils communs aux modules commerce et banque : jours ouvrés, dates
 * civiles de Paris, montants en centimes et plan des opérations bancaires.
 *
 * Le commerce ne touche jamais la banque lui-même : il décrit, pour chaque
 * pièce réglée par la banque, l'opération qui apparaîtra sur le relevé et le
 * règlement à y rapprocher (`ctx.partage.commerce.operations`). Le module
 * banque, joué en dernier, importe ce relevé comme un CSV puis rapproche les
 * règlements par les fonctions de l'application.
 */

import { dateIsoFacture } from "../../src/lib/facture-regles"
import { AUJ, NOW, type Contexte } from "./contexte"

const JOUR_MS = 86_400_000

// ─── Dates ──────────────────────────────────────────────────────────────────
/** Midi UTC du jour civil `iso` (AAAA-MM-JJ) : c'est l'heure des relevés importés. */
export function midi(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}
/** Jour civil (Paris) d'une date. */
export const iso = (d: Date) => dateIsoFacture(d)
/** Jour civil décalé de `n` jours. */
export function isoPlus(jourIso: string, n: number): string {
  return new Date(midi(jourIso).getTime() + n * JOUR_MS).toISOString().slice(0, 10)
}
/** Jour civil d'aujourd'hui (reseed), et d'il y a `n` jours. */
export const AUJ_ISO = AUJ.toISOString().slice(0, 10)
export const ilYaIso = (n: number) => isoPlus(AUJ_ISO, -n)
/** Jour de semaine ISO : 1 = lundi … 7 = dimanche. */
export function jourSemaine(jourIso: string): number {
  return ((midi(jourIso).getUTCDay() + 6) % 7) + 1
}
/** Dernier jour civil `jourIso` ou avant tombant le jour de semaine `j` (1 = lundi). */
export function dernier(j: number, jourIso: string): string {
  return isoPlus(jourIso, -((jourSemaine(jourIso) - j + 7) % 7))
}
/** Prochain jour civil `jourIso` ou après tombant le jour de semaine `j`. */
export function prochain(j: number, jourIso: string): string {
  return isoPlus(jourIso, (j - jourSemaine(jourIso) + 7) % 7)
}
/** Une date (instant) est-elle passée par rapport à l'horloge du reseed ? */
export const estPasse = (d: Date) => d.getTime() <= NOW.getTime()
/** Instant du jour civil `jourIso` à `heure` h UTC. */
export function aHeure(jourIso: string, heure: number, minute = 0): Date {
  return new Date(Date.UTC(Number(jourIso.slice(0, 4)), Number(jourIso.slice(5, 7)) - 1, Number(jourIso.slice(8, 10)), heure, minute))
}

/** Dimanche de Pâques (algorithme de Meeus/Butcher). */
function paques(annee: number): string {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31), jourMois = ((h + l - 7 * m + 114) % 31) + 1
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jourMois).padStart(2, "0")}`
}
const feriesCache = new Map<number, Set<string>>()
/** Jours fériés de métropole : les banques ne passent aucune écriture ces jours-là. */
export function estFerie(jourIso: string): boolean {
  const annee = Number(jourIso.slice(0, 4))
  let s = feriesCache.get(annee)
  if (!s) {
    const p = paques(annee)
    s = new Set([
      ...["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"].map((md) => `${annee}-${md}`),
      isoPlus(p, 1), isoPlus(p, 39), isoPlus(p, 50),
    ])
    feriesCache.set(annee, s)
  }
  return s.has(jourIso)
}
export const estOuvre = (jourIso: string) => jourSemaine(jourIso) <= 5 && !estFerie(jourIso)
/** Premier jour ouvré `jourIso` ou après (date de valeur d'un prélèvement). */
export function ouvreSuivant(jourIso: string): string {
  let j = jourIso
  while (!estOuvre(j)) j = isoPlus(j, 1)
  return j
}
/** Dernier jour ouvré `jourIso` ou avant. */
export function ouvrePrecedent(jourIso: string): string {
  let j = jourIso
  while (!estOuvre(j)) j = isoPlus(j, -1)
  return j
}
/** Dernier jour du mois. */
export function finDeMois(annee: number, mois: number): string {
  return new Date(Date.UTC(annee, mois, 0, 12)).toISOString().slice(0, 10)
}
export const isoDe = (annee: number, mois: number, j: number) =>
  `${annee}-${String(mois).padStart(2, "0")}-${String(j).padStart(2, "0")}`

// ─── Montants ───────────────────────────────────────────────────────────────
export const centimes = (euros: number) => Math.round((euros + Math.sign(euros) * Number.EPSILON) * 100)
export const euros = (c: number) => c / 100
/** Montant à deux décimales, en texte, tel que le saisit l'application (« 123.45 »). */
export const texteMontant = (c: number) => (Math.abs(c) / 100).toFixed(2)
/** HT au centime → TVA au centime → TTC, comme une facture fournisseur. */
export function depuisHT(ht: number, taux: number) {
  const montantHT = Math.round(ht * 100) / 100
  const montantTVA = Math.round(montantHT * taux) / 100
  return { montantHT, montantTVA, montant: Math.round((montantHT + montantTVA) * 100) / 100 }
}

// ─── Plan des opérations bancaires ──────────────────────────────────────────
export type TypeCible = "Facture" | "VenteManuelle" | "DepenseManuelle" | "VenteProduit"
export type ModeBancaire = "Virement" | "Chèque" | "CB" | "Prélèvement"
export interface ReglementPrevu {
  cible: { type: TypeCible; id: number }
  centimes: number
  mode: ModeBancaire
}
export interface OperationPrevue {
  /** Jour civil de l'opération sur le relevé. */
  jour: string
  libelle: string
  /** Signé : positif au crédit, négatif au débit. */
  centimes: number
  /** Règlements à rapprocher (vide : opération sans pièce). */
  reglements: ReglementPrevu[]
  /** Laissée non rapprochée, pour que le visiteur la rapproche lui-même. */
  aRapprocherParLeVisiteur?: boolean
  /** Motif d'exclusion (statut « ignorée »). */
  exclusion?: string
}
export interface PartageCommerce {
  operations: OperationPrevue[]
}

/** Plan partagé avec le module banque (créé au premier appel). */
export function planBancaire(ctx: Contexte): PartageCommerce {
  const existant = ctx.partage.commerce as PartageCommerce | undefined
  if (existant) return existant
  const plan: PartageCommerce = { operations: [] }
  ctx.partage.commerce = plan
  return plan
}

/** Une opération bancaire ne peut être datée qu'au plus tard hier : le relevé est importé aujourd'hui. */
export function ajouterOperation(ctx: Contexte, op: OperationPrevue) {
  if (op.jour >= AUJ_ISO) throw new Error(`Opération bancaire datée du ${op.jour}, après le dernier relevé (${ilYaIso(1)}) : ${op.libelle}`)
  if (!op.centimes) throw new Error(`Opération bancaire nulle : ${op.libelle}`)
  const somme = op.reglements.reduce((n, r) => n + r.centimes, 0)
  if (somme > Math.abs(op.centimes)) throw new Error(`Règlements supérieurs à l'opération ${op.libelle}`)
  planBancaire(ctx).operations.push(op)
}
