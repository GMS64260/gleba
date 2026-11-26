import { describe, expect, it } from "vitest"

import { destinationsNoter, estCoquilleV2Active } from "./navigation-principale"

const liens = (pathname: string | null, modules: Parameters<typeof destinationsNoter>[1]) =>
  destinationsNoter(pathname, modules).map(d => d.href)

describe("destinationsNoter", () => {
  it("mène l'éleveur à sa tournée et l'arboriculteur à son verger, sans passer par le maraîchage", () => {
    expect(liens("/aujourdhui", ["elevage", "comptabilite"])).toEqual(["/elevage/tournee"])
    expect(liens("/aujourdhui", ["verger"])).toEqual(["/verger?tab=calendrier"])
    expect(liens("/aujourdhui", ["maraichage"])).toEqual(["/taches"])
  })

  it("propose le choix sur une page commune quand la ferme a plusieurs univers", () => {
    expect(liens("/aujourdhui", ["maraichage", "verger", "elevage", "comptabilite"])).toEqual([
      "/taches",
      "/verger?tab=calendrier",
      "/elevage/tournee",
    ])
    expect(liens("/jardin", ["elevage", "maraichage"])).toEqual(["/taches", "/elevage/tournee"])
  })

  it("suit l'univers de la page ouverte", () => {
    const tous = ["maraichage", "verger", "elevage"] as const
    expect(liens("/elevage/animaux", tous)).toEqual(["/elevage/tournee"])
    expect(liens("/verger", tous)).toEqual(["/verger?tab=calendrier"])
    expect(liens("/maraichage/cultures", tous)).toEqual(["/taches"])
    expect(liens("/taches", tous)).toEqual(["/taches"])
  })

  it("ne suit pas une page dont l'univers est désactivé", () => {
    expect(liens("/elevage", ["maraichage", "verger"])).toEqual(["/taches", "/verger?tab=calendrier"])
    expect(liens("/verger-autre", ["maraichage", "verger"])).toHaveLength(2)
  })

  it("garde les tâches quand aucun univers de production n'est actif", () => {
    expect(liens("/aujourdhui", ["comptabilite"])).toEqual(["/taches"])
    expect(liens(null, [])).toEqual(["/taches"])
  })
})

describe("estCoquilleV2Active", () => {
  it("habille toute page connectée, sans préférence d'accueil", () => {
    expect(estCoquilleV2Active("/maraichage", true)).toBe(true)
    expect(estCoquilleV2Active("/aujourdhui", true)).toBe(true)
    expect(estCoquilleV2Active("/maraichage", false)).toBe(false)
    expect(estCoquilleV2Active("/admin/bugs", true)).toBe(false)
    expect(estCoquilleV2Active("/login", true)).toBe(false)
  })
})
