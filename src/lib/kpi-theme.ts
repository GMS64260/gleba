/**
 * kpi-theme — design token sémantique COMMUN pour les KPI cards des dashboards.
 *
 * Une couleur par TYPE de donnée (pas par module) :
 *   - revenu  → vert (emerald) : revenus, valeur positive, production récoltée
 *   - depense → rouge (red)    : dépenses, coûts, pertes
 *   - alerte  → orange (amber) : alertes, à faire, urgences, en attente
 *   - neutre  → gris (slate)   : totaux, effectifs, informationnel
 *
 * UNE seule source de vérité. Reprend le style visuel existant des grosses
 * cartes (gradient `bg-gradient-to-br`, texte blanc) en ne pilotant que la
 * teinte via le `tone`.
 *
 * Client-safe : aucun import serveur (utilisable dans des composants "use client").
 */

export type KpiTone = "revenu" | "depense" | "alerte" | "neutre"

interface KpiToneClasses {
  /** Classe complète à poser sur le <Card> (gradient + texte blanc). */
  card: string
  /** Classe de couleur pour les libellés/sous-titres secondaires (CardDescription, <p>…). */
  subtle: string
}

/**
 * Mapping tone → classes Tailwind.
 *
 * Les gradients reprennent les teintes déjà en place dans les dashboards :
 * `from-{couleur}-500 to-{couleur}-600` sur fond, texte blanc, et un ton
 * clair `text-{couleur}-100` pour les descriptions (contraste lisible sur
 * fond saturé, ≥ WCAG AA).
 */
export const KPI_TONES: Record<KpiTone, KpiToneClasses> = {
  revenu: {
    card: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
    subtle: "text-emerald-100",
  },
  depense: {
    card: "bg-gradient-to-br from-red-500 to-red-600 text-white",
    subtle: "text-red-100",
  },
  alerte: {
    card: "bg-gradient-to-br from-amber-500 to-amber-600 text-white",
    subtle: "text-amber-100",
  },
  neutre: {
    card: "bg-gradient-to-br from-slate-700 to-slate-800 text-white",
    subtle: "text-slate-300",
  },
}

/** Classe(s) du conteneur Card pour un tone donné. */
export function kpiCardClass(tone: KpiTone): string {
  return KPI_TONES[tone].card
}

/** Classe de couleur des libellés secondaires (descriptions, sous-titres) pour un tone donné. */
export function kpiSubtleClass(tone: KpiTone): string {
  return KPI_TONES[tone].subtle
}
