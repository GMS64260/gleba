import { describe, expect, it } from "vitest"
import { venteProduitSchema } from "../elevage-vente"

describe("venteProduitSchema - produits de la ruche", () => {
  it.each([
    ["miel", "kg"],
    ["cire", "kg"],
    ["propolis", "g"],
    ["pollen", "kg"],
    ["gelee_royale", "g"],
    ["autre_ruche", "kg"],
  ])("accepte une vente de %s", (type, unite) => {
    expect(venteProduitSchema.safeParse({
      type,
      quantite: 1.5,
      unite,
      prixUnitaire: 12,
      paye: true,
    }).success).toBe(true)
  })

  it("laisse l’API appliquer le taux par défaut quand il n’est pas fourni", () => {
    const result = venteProduitSchema.parse({
      type: "cire",
      quantite: 2,
      unite: "kg",
      prixUnitaire: 10,
      paye: true,
    })
    expect(result.tauxTVA).toBeUndefined()
  })
})
