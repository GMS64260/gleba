export const ONGLETS_COMMUNAUTE = ["encyclopedie", "contribuer", "salon", "propositions", "roadmap"] as const
export type OngletCommunaute = typeof ONGLETS_COMMUNAUTE[number]

export function lireOngletCommunaute(value: string | null | undefined): OngletCommunaute {
  return (ONGLETS_COMMUNAUTE as readonly string[]).includes(value ?? "") ? value as OngletCommunaute : "encyclopedie"
}

export function urlOngletCommunaute(onglet: OngletCommunaute, recherche: string) {
  const params = new URLSearchParams(recherche)
  params.set("tab", onglet)
  return `/communaute?${params}`
}
