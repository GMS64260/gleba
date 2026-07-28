import { describe, expect, it } from "vitest"
import {
  LIENS_RACCOURCIS_COMPAGNIE,
  urlNaissancesDashboardCompagnie,
} from "./dashboard-compagnie"

describe("dashboard compagnie", () => {
  it("demande les statistiques de toute l'année et de la filière", () => {
    expect(urlNaissancesDashboardCompagnie(2024, "compagnie"))
      .toBe("/api/elevage/naissances?annee=2024&filiere=compagnie")
    expect(urlNaissancesDashboardCompagnie(2024, "toutes"))
      .toBe("/api/elevage/naissances?annee=2024")
  })

  it("ouvre réellement les formulaires annoncés par les raccourcis", () => {
    expect(LIENS_RACCOURCIS_COMPAGNIE.nouveauSoin).toContain("action=nouveau-soin")
    expect(LIENS_RACCOURCIS_COMPAGNIE.nouvelleNaissance)
      .toContain("action=nouvelle-naissance")
  })
})
