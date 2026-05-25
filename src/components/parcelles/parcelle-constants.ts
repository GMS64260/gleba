export interface ParcelleWithRelations {
  id: string
  nom: string
  surface: number | null
  couches: string[]
  usage: string | null
  geometry: string
  centroidLat: number | null
  centroidLng: number | null
  _count: { planches: number; arbres: number; lotsAnimaux: number }
}

/**
 * Feedback testeur cmpkycncq — La liste /parcelles affichait "-" pour les
 * parcelles qui n'avaient que l'ancien champ `usage` rempli (avant
 * l'introduction des couches typées). La carte /jardin/carte affiche déjà
 * `usage`. On unifie en lisant `usage` comme fallback quand `couches` est
 * vide, et on mappe vers les libellés couches connus.
 */
const USAGE_TO_COUCHE: Record<string, string> = {
  culture: "MARAICHAGE",
  maraichage: "MARAICHAGE",
  maraîchage: "MARAICHAGE",
  potager: "MARAICHAGE",
  jardin: "MARAICHAGE",
  verger: "VERGER",
  elevage: "ELEVAGE",
  élevage: "ELEVAGE",
  paturage: "PATURAGE",
  pâturage: "PATURAGE",
  prairie: "PATURAGE",
}

export function resoudreCouches(parcelle: { couches: string[]; usage: string | null }): string[] {
  if (parcelle.couches?.length > 0) return parcelle.couches
  if (!parcelle.usage) return []
  return Array.from(new Set(
    parcelle.usage
      .split(',')
      .map(u => u.trim().toLowerCase())
      .map(u => USAGE_TO_COUCHE[u])
      .filter(Boolean)
  ))
}

export const COUCHE_COLORS: Record<string, string> = {
  MARAICHAGE: "bg-emerald-100 text-emerald-800",
  VERGER: "bg-lime-100 text-lime-800",
  ELEVAGE: "bg-amber-100 text-amber-800",
  PATURAGE: "bg-green-100 text-green-800",
}

export const COUCHE_LABELS: Record<string, string> = {
  MARAICHAGE: "Maraîchage",
  VERGER: "Verger",
  ELEVAGE: "Élevage",
  PATURAGE: "Pâturage",
}

export function formatSurface(ha: number | null): string {
  if (ha == null) return "-"
  const m2 = ha * 10000
  return m2 >= 10000
    ? `${ha.toFixed(2)} ha`
    : `${Math.round(m2)} m\u00B2`
}

export function formatEntites(count: { planches: number; arbres: number; lotsAnimaux: number }): string {
  const parts: string[] = []
  if (count.planches > 0) parts.push(`${count.planches} planche${count.planches > 1 ? "s" : ""}`)
  if (count.arbres > 0) parts.push(`${count.arbres} arbre${count.arbres > 1 ? "s" : ""}`)
  if (count.lotsAnimaux > 0) parts.push(`${count.lotsAnimaux} lot${count.lotsAnimaux > 1 ? "s" : ""}`)
  return parts.join(", ")
}
