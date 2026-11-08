/**
 * Groupes d'usage et segments de /admin/usage : constantes pures, sans
 * Prisma, partagées entre l'API et la page (voir `src/lib/admin-usage.ts`).
 */

import { MODULE_IDS, type ModuleId } from "@/lib/modules"

export type GroupeUsageId = ModuleId | "terrain" | "communaute"

export const GROUPES_USAGE: Array<{ id: GroupeUsageId; libelle: string; module: boolean }> = [
  { id: "maraichage", libelle: "Maraîchage", module: true },
  { id: "verger", libelle: "Verger", module: true },
  { id: "elevage", libelle: "Élevage", module: true },
  { id: "comptabilite", libelle: "Comptabilité", module: true },
  { id: "terrain", libelle: "Plan, notes et stocks", module: false },
  { id: "communaute", libelle: "Communauté", module: false },
]

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export type Segment = "nouveau" | "regulier" | "occasionnel" | "decroche" | "jamais_revenu"

export const SEGMENTS: Array<{ id: Segment; libelle: string; aide: string }> = [
  { id: "regulier", libelle: "Régulier", aide: "Venu au moins 3 des 4 dernières semaines" },
  { id: "occasionnel", libelle: "Occasionnel", aide: "Venu dans les 30 derniers jours, sans régularité" },
  { id: "nouveau", libelle: "Nouveau", aide: "Inscrit depuis 14 jours ou moins" },
  { id: "decroche", libelle: "Décroché", aide: "Revenu au moins une fois, absent depuis plus de 30 jours" },
  { id: "jamais_revenu", libelle: "Jamais revenu", aide: "Un seul jour d'activité, ou aucun" },
]

export interface EntreeSegment {
  inscritDepuisJours: number
  joursActifsTotal: number
  /** Semaines glissantes (0 à 4) avec au moins un jour actif sur les 28 derniers jours. */
  semainesActives4: number
  /** Jours écoulés depuis le dernier jour actif, null si jamais actif. */
  joursDepuisDerniere: number | null
}

export function classerSegment(e: EntreeSegment): Segment {
  if (e.inscritDepuisJours <= 14) return "nouveau"
  if (e.semainesActives4 >= 3) return "regulier"
  if (e.joursActifsTotal <= 1) return "jamais_revenu"
  if (e.joursDepuisDerniere !== null && e.joursDepuisDerniere <= 30) return "occasionnel"
  return "decroche"
}

/** Modules affichés d'après la préférence `modulesActifs` (absente = tous). */
export function lireModulesActifs(valeur: string | null | undefined): ModuleId[] {
  if (!valeur) return [...MODULE_IDS]
  try {
    const brut: unknown = JSON.parse(valeur)
    if (!Array.isArray(brut)) return [...MODULE_IDS]
    const ok = brut.filter((m): m is ModuleId => (MODULE_IDS as string[]).includes(m))
    return ok.length > 0 ? ok : [...MODULE_IDS]
  } catch {
    return [...MODULE_IDS]
  }
}

export function joursEntre(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000)
}
