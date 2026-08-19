import { describe, expect, it } from "vitest"
import { productionRucheSchema } from "../elevage-production-ruche"

describe("productionRucheSchema", () => {
  it("accepte les produits et unités prévus", () => {
    expect(productionRucheSchema.safeParse({
      date: "2026-07-29",
      produit: "miel",
      quantite: 18.5,
      unite: "kg",
      lotId: 12,
      numeroLot: "MIEL-2026-04",
    }).success).toBe(true)

    expect(productionRucheSchema.safeParse({
      produit: "gelee_royale",
      quantite: 250,
      unite: "g",
    }).success).toBe(true)
  })

  it("refuse une quantité non positive et une unité libre", () => {
    expect(productionRucheSchema.safeParse({
      produit: "miel",
      quantite: 0,
      unite: "kg",
    }).success).toBe(false)
    expect(productionRucheSchema.safeParse({
      produit: "miel",
      quantite: 10,
      unite: "litre",
    }).success).toBe(false)
  })
})
