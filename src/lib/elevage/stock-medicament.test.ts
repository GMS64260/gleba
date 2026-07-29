import { describe, expect, it } from "vitest"
import { stockMedicamentEstDisponible } from "./stock-medicament"

describe("stockMedicamentEstDisponible", () => {
  it("accepte un lot approvisionné sans date de péremption", () => {
    expect(stockMedicamentEstDisponible(
      { quantite: 7, datePeremption: null },
      "2026-07-29",
    )).toBe(true)
  })

  it("accepte un lot qui périme le jour du soin", () => {
    expect(stockMedicamentEstDisponible(
      { quantite: 7, datePeremption: "2026-07-29T00:00:00.000Z" },
      "2026-07-29",
    )).toBe(true)
  })

  it("refuse un lot épuisé ou déjà périmé", () => {
    expect(stockMedicamentEstDisponible(
      { quantite: 0, datePeremption: "2026-08-01T00:00:00.000Z" },
      "2026-07-29",
    )).toBe(false)
    expect(stockMedicamentEstDisponible(
      { quantite: 7, datePeremption: "2026-07-28T00:00:00.000Z" },
      "2026-07-29",
    )).toBe(false)
  })
})
