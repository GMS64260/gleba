import { describe, expect, it } from "vitest"
import { createFactureSchema } from "../facture"

function factureValide() {
  return {
    totalHT: 20,
    totalTVA: 1.1,
    totalTTC: 21.1,
    lignes: [{
      description: "Légumes",
      quantite: 2,
      unite: "kg",
      prixUnitaire: 10,
      tauxTVA: 5.5,
      montantHT: 20,
      montantTVA: 1.1,
      montantTTC: 21.1,
    }],
  }
}

describe("createFactureSchema", () => {
  it("accepte des montants cohérents", () => {
    expect(createFactureSchema.safeParse(factureValide()).success).toBe(true)
  })

  it("refuse un HT incompatible avec quantité × prix", () => {
    const input = factureValide()
    input.lignes[0].prixUnitaire = 9
    expect(createFactureSchema.safeParse(input).success).toBe(false)
  })

  it("refuse une TVA incompatible avec le taux annoncé", () => {
    const input = factureValide()
    input.lignes[0].tauxTVA = 20
    expect(createFactureSchema.safeParse(input).success).toBe(false)
  })

  it("refuse un total de TVA différent de la somme des lignes", () => {
    const input = factureValide()
    input.totalTVA = 0
    expect(createFactureSchema.safeParse(input).success).toBe(false)
  })
})
