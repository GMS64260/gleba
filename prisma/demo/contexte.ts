/**
 * Socle commun du jeu de données démo « Ferme du Bois Joli ».
 *
 * Chaque module (`terrain`, `maraichage`, `verger`, `elevage`, `commerce`…)
 * reçoit le même contexte : le client Prisma de l'application (celui que les
 * fonctions de `src/lib` utilisent aussi), le compte visé et l'horloge.
 *
 * Règle d'or : le calendrier est RÉEL. Une culture, une mise-bas ou une
 * récolte de miel est posée à sa vraie date de saison ; seul son état (fait,
 * en cours, à venir) dépend du jour où le seed tourne. Un reseed en novembre
 * montre donc des poireaux et de la mâche, pas des tomates en pleine récolte.
 */

import prisma from "../../src/lib/prisma"

export { prisma }

// ─── Horloge ────────────────────────────────────────────────────────────────
// DEMO_DATE (AAAA-MM-JJ) simule un autre jour de reseed : réservé aux essais
// sur base jetable, jamais en production (les fonctions de src/lib lisent la
// vraie horloge pour leurs contrôles « pas de date future »).
const forcee = process.env.DEMO_DATE ? new Date(`${process.env.DEMO_DATE}T10:00:00Z`) : null
export const NOW = forcee && !Number.isNaN(forcee.getTime()) ? forcee : new Date()
export const Y = NOW.getUTCFullYear()
/** Aujourd'hui à 00:00 UTC. */
export const AUJ = new Date(Date.UTC(Y, NOW.getUTCMonth(), NOW.getUTCDate()))

const JOUR_MS = 86_400_000

/** Date calendaire (mois 1-12), à `heure` UTC (8 h par défaut). */
export function jour(annee: number, mois: number, j: number, heure = 8): Date {
  return new Date(Date.UTC(annee, mois - 1, j, heure, 0, 0))
}
/** Il y a `n` jours (n < 0 : dans |n| jours), à `heure` UTC. */
export function ilYa(n: number, heure = 8): Date {
  return new Date(AUJ.getTime() - n * JOUR_MS + heure * 3_600_000)
}
export function plusJours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * JOUR_MS)
}
/** Minuit UTC du même jour. */
export function minuit(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}
/** Vrai si la date est passée (ou maintenant). */
export function passe(d: Date | null | undefined): boolean {
  return !!d && d.getTime() <= NOW.getTime()
}
/** Écart en jours entiers entre deux dates (b − a). */
export function joursEntre(a: Date, b: Date): number {
  return Math.round((minuit(b).getTime() - minuit(a).getTime()) / JOUR_MS)
}
/**
 * Année de la dernière occurrence PASSÉE du jour (mois, j) : sert à caler un
 * cycle saisonnier (mises-bas, miellées…) sur la saison qui vient de se jouer.
 */
export function anneeDerniere(mois: number, j: number): number {
  return jour(Y, mois, j, 0).getTime() <= AUJ.getTime() ? Y : Y - 1
}
/** Lundi (00:00 UTC) de la semaine de `d`. */
export function lundi(d: Date): Date {
  const m = minuit(d)
  const dow = (m.getUTCDay() + 6) % 7
  return plusJours(m, -dow)
}
/** Semaine ISO 8601 : celle de l'application (numéros de lots de fromage). */
export { isoWeek } from "../../src/lib/lait"

// ─── Hasard déterministe ────────────────────────────────────────────────────
/** Générateur reproductible (mulberry32) : même seed, mêmes données. */
export function alea(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}
/** Graine stable tirée d'un libellé. */
export function graine(libelle: string): number {
  let h = 2166136261
  for (const c of libelle) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

// ─── Montants ───────────────────────────────────────────────────────────────
export const round2 = (n: number) => Math.round(n * 100) / 100
export const round1 = (n: number) => Math.round(n * 10) / 10
/** Montant TTC → HT et TVA, au centime, TTC = HT + TVA exactement. */
export function splitTTC(ttc: number, taux: number) {
  const montant = round2(ttc)
  const montantHT = taux ? round2(montant / (1 + taux / 100)) : montant
  const montantTVA = round2(montant - montantHT)
  return { montant, montantHT, montantTVA }
}

// ─── Identité fiscale fictive (clés Luhn et IBAN valides) ────────────────────
// Numéros vérifiés NON ATTRIBUÉS dans l'annuaire des entreprises
// (recherche-entreprises.api.gouv.fr, 2026-11-03) : les anciens numéros
// « fictifs » du seed appartenaient à de vraies entreprises. Ne jamais en
// reprendre un sans le vérifier. Banque fictive (code 19999), EDE sur une commune inexistante
// (999), téléphones dans la plage réservée à la fiction par l'ARCEP.
export const IDENTITE = {
  raisonSociale: "EARL Ferme du Bois Joli",
  exploitants: "Camille et Thomas Lefèvre",
  siret: "01222399600013",
  siren: "012223996",
  tvaIntra: "FR83012223996",
  numeroEde: "85999001",
  iban: "FR76 1999 9000 0100 0123 4560 152",
  bic: "BOCAFRP1XXX",
  banque: "Banque coopérative du Bocage",
  adresse: "Le Bois Joli",
  codePostal: "85600",
  ville: "La Boissière-de-Montaigu",
  email: "ferme-bois-joli@example.com",
  telephone: "02 61 91 00 10",
  certificateur: "Ecocert FR-BIO-01",
} as const

// ─── Contexte partagé entre modules ─────────────────────────────────────────
export type Contexte = {
  userId: string
  /** Vrai quand le seed vise un autre compte (DEMO_EMAIL_OVERRIDE). */
  clone: boolean
  exploitationId: string
  /** Parcelles par clé courte : V verger, A serre, C tunnel, B plein champ, P pâture, F prairie de fauche. */
  parcelles: Record<string, string>
  /** Planches par nom (A1…C4). */
  planches: Record<string, string>
  /** Clients par clé courte (restaurant, epicerie, cantine…). */
  clients: Record<string, { id: number; nom: string }>
  /** Sorties utiles d'un module à un autre (lots de stock, factures à émettre…). */
  partage: Record<string, unknown>
}

export function journal(message: string) {
  console.log(`  ✓ ${message}`)
}
