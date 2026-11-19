/** Les trois lectures du plan 2D partagent la même saison et le même encodage. */
export function urlPlanJardin(annee: number, parcelle: string | null): string {
  const params = new URLSearchParams({ annee: String(annee), parcelle: parcelle ?? "all" })
  return `/api/jardin?${params}`
}
