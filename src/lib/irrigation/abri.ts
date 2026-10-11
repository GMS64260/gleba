/**
 * Une planche est-elle sous abri (serre, tunnel, châssis) ? Sous abri, la pluie
 * n'entre pas et l'évapotranspiration est réduite (`bilan-sol.ts`).
 *
 * Seule règle des écrans d'arrosage et de pluviométrie : la liste était
 * recopiée dans quatre fichiers. Le type de planche est facultatif ; sans
 * lui, on ne sait pas (`null`) et le conseil le dit au lieu de compter la
 * pluie en silence (ticket QA cmv3ja7nr : planche sans type dans une parcelle
 * « Tunnel maraîcher », 9 mm de pluie portés à son crédit).
 */
import { normaliserNom } from './bilan-sol'

const TYPES_SOUS_ABRI = ['serre', 'tunnel', 'chassis', 'abri']

/**
 * true sous abri, false en plein champ, null si le type de planche n'est pas
 * renseigné. Le type est un texte libre : « Hors abri », « Sans abri »,
 * « Plein champ » et « Plein air » sont en plein champ.
 */
export function typeSousAbri(type: string | null | undefined): boolean | null {
  const t = normaliserNom(type ?? '')
  if (!t) return null
  // Pas « Serre hors-sol » ni « Tunnel sans chauffage » (contre-revue).
  if (/\b(hors|sans) abri\b|\bplein (champ|air)\b/.test(t)) return false
  return TYPES_SOUS_ABRI.some((abri) => t.includes(abri))
}

/** Sous abri connu ; un type absent compte comme plein champ. */
export function estSousAbri(type: string | null | undefined): boolean {
  return typeSousAbri(type) === true
}
