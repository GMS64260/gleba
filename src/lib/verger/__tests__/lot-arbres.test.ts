import { describe, expect, it } from "vitest"
import { parcelleCompatibleVerger, validerLotArbres } from "../lot-arbres"

describe("lot d’arbres agrégé", () => {
  it("refuse un effectif nul ou décimal", () => {
    expect(validerLotArbres({ nom: "Oliviers", espece: "Olivier", effectif: 0, parcelleGeoId: "p1" })).toMatch(/strictement positif/)
    expect(validerLotArbres({ nom: "Oliviers", espece: "Olivier", effectif: 2.5, parcelleGeoId: "p1" })).toMatch(/entier/)
  })

  it("reconnaît l’usage ou la couche verger", () => {
    expect(parcelleCompatibleVerger({ usage: "culture, verger", couches: [] })).toBe(true)
    expect(parcelleCompatibleVerger({ usage: null, couches: ["VERGER"] })).toBe(true)
    expect(parcelleCompatibleVerger({ usage: "prairie", couches: [] })).toBe(false)
  })
})
