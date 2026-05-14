export interface ParcelleWithRelations {
  id: string
  nom: string
  surface: number | null
  couches: string[]
  geometry: string
  centroidLat: number | null
  centroidLng: number | null
  _count: { planches: number; arbres: number; lotsAnimaux: number }
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
