import { describe, expect, it } from "vitest"

import { destinationsNoter, estCoquilleV2Active, universNoterCourant } from "./navigation-principale"

const liens = (modules: Parameters<typeof destinationsNoter>[0]) => destinationsNoter(modules).map(d => d.href)

describe("destinationsNoter", () => {
  it("mène l'éleveur à sa tournée et l'arboriculteur à son verger, sans passer par le maraîchage", () => {
    expect(liens(["elevage", "comptabilite"])).toEqual(["/elevage/tournee"])
    expect(liens(["verger"])).toEqual(["/verger?tab=calendrier"])
    expect(liens(["maraichage"])).toEqual(["/taches"])
  })

  it("rend tous les univers actifs de la ferme, dans l'ordre", () => {
    expect(liens(["maraichage", "verger", "elevage", "comptabilite"])).toEqual(["/taches", "/verger?tab=calendrier", "/elevage/tournee"])
    expect(liens(["elevage", "maraichage"])).toEqual(["/taches", "/elevage/tournee"])
  })

  it("garde les tâches quand aucun univers de production n'est actif", () => {
    expect(liens(["comptabilite"])).toEqual(["/taches"])
    expect(liens([])).toEqual(["/taches"])
  })
})

describe("universNoterCourant", () => {
  const tous = ["maraichage", "verger", "elevage"] as const

  it("reconnaît l'univers de la page ouverte", () => {
    expect(universNoterCourant("/elevage/animaux", tous)).toBe("elevage")
    expect(universNoterCourant("/verger", tous)).toBe("verger")
    expect(universNoterCourant("/maraichage/cultures", tous)).toBe("maraichage")
    expect(universNoterCourant("/taches", tous)).toBe("maraichage")
  })

  it("n'en signale aucun sur une page commune ou pour un univers désactivé", () => {
    expect(universNoterCourant("/aujourdhui", tous)).toBeNull()
    expect(universNoterCourant("/verger-autre", tous)).toBeNull()
    expect(universNoterCourant("/elevage", ["maraichage", "verger"])).toBeNull()
    expect(universNoterCourant(null, tous)).toBeNull()
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
