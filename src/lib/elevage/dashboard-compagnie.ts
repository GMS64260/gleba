import type { FiliereSelection } from "./filiere-context"

export const LIENS_RACCOURCIS_COMPAGNIE = {
  nouveauSoin: "/elevage?tab=alimentation&sub=soins&action=nouveau-soin",
  nouvelleNaissance: "/elevage?tab=reproduction&sub=naissances&action=nouvelle-naissance",
} as const

export function urlNaissancesDashboardCompagnie(
  year: number,
  filiere: FiliereSelection,
): string {
  const params = new URLSearchParams({ annee: String(year) })
  if (filiere !== "toutes") params.set("filiere", filiere)
  return `/api/elevage/naissances?${params.toString()}`
}
