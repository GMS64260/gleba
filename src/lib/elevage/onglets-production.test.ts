import { describe, expect, it } from "vitest"
import { ongletLaitDepuisSub, ongletProductionDepuisSub } from "./onglets-production"

describe("liens directs vers Élevage > Production (revue 2026-11-01)", () => {
  it("ouvre l'onglet nommé par sub, quel que soit le profil du cheptel", () => {
    expect(ongletProductionDepuisSub("ventes")).toBe("ventes")
    expect(ongletProductionDepuisSub("oeufs")).toBe("oeufs")
    expect(ongletProductionDepuisSub("ruche")).toBe("ruche")
  })

  it("rattache les sous-onglets du lait et l'alias fromage à Lait", () => {
    expect(ongletProductionDepuisSub("cave")).toBe("lait")
    expect(ongletProductionDepuisSub("fromage")).toBe("lait")
    expect(ongletLaitDepuisSub("fromage")).toBe("cave")
    expect(ongletLaitDepuisSub("fabrications")).toBe("fabrications")
  })

  it("ignore un sub absent ou inconnu", () => {
    expect(ongletProductionDepuisSub(null)).toBeNull()
    expect(ongletProductionDepuisSub("registre")).toBeNull()
    expect(ongletLaitDepuisSub("ventes")).toBeNull()
  })
})
