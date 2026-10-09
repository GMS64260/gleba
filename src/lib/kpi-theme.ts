/**
 * kpi-theme — design token sémantique COMMUN pour les KPI cards des dashboards.
 *
 * Une couleur par TYPE de donnée (pas par module) :
 *   - revenu  → vert (emerald) : revenus, valeur positive, production récoltée
 *   - depense → rouge (red)    : dépenses, coûts, pertes
 *   - alerte  → orange (amber) : alertes, à faire, urgences, en attente
 *   - neutre  → gris (slate)   : totaux, effectifs, informationnel
 *
 * UNE seule source de vérité. Depuis la charte « carnet de ferme »
 * (2026-10-09), la carte est à plat : craie, bordure lin, liseré de couleur
 * à gauche selon le `tone`, texte en encre.
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
  // Charte « carnet de ferme » (2026-10-09) : plus de dégradé ni de texte
  // blanc sur fond saturé. Carte craie bordée de lin, liseré de 4 px à gauche
  // qui dit la nature de la donnée (prairie = revenu, garance = dépense,
  // paille = attention, lin = information), texte en encre et ardoise.
  revenu: {
    card: "border border-lin border-l-4 border-l-prairie bg-craie text-encre shadow-none",
    subtle: "text-ardoise",
  },
  depense: {
    card: "border border-lin border-l-4 border-l-garance bg-craie text-encre shadow-none",
    subtle: "text-ardoise",
  },
  alerte: {
    card: "border border-lin border-l-4 border-l-paille bg-craie text-encre shadow-none",
    subtle: "text-ardoise",
  },
  neutre: {
    card: "border border-lin border-l-4 border-l-lin bg-craie text-encre shadow-none",
    subtle: "text-ardoise",
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
