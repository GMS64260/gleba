import { describe, expect, it } from "vitest"
import {
  estLotApicole,
  tauxTvaVenteProduitParDefaut,
  typeVenteVersProduitRuche,
  uniteProduitRucheParDefaut,
} from "../produits-ruche"

describe("produits de la ruche", () => {
  it("reconnaît un lot apicole par catégorie, espèce ou production", () => {
    expect(estLotApicole({
      especeAnimale: { categorieReglementaire: "Apiculture" },
    })).toBe(true)
    expect(estLotApicole({
      especeAnimale: { id: "abeille_domestique" },
    })).toBe(true)
    expect(estLotApicole({
      especeAnimale: { productions: ["Miel", "Cire"] },
    })).toBe(true)
    expect(estLotApicole({
      especeAnimale: { id: "chevre_laitiere", production: "lait" },
    })).toBe(false)
  })

  it("propose le gramme pour les petits volumes", () => {
    expect(uniteProduitRucheParDefaut("gelee_royale")).toBe("g")
    expect(uniteProduitRucheParDefaut("propolis")).toBe("g")
    expect(uniteProduitRucheParDefaut("miel")).toBe("kg")
  })

  it("distingue les ventes apicoles et propose une TVA modifiable cohérente", () => {
    expect(typeVenteVersProduitRuche("miel")).toBe("miel")
    expect(typeVenteVersProduitRuche("autre_ruche")).toBe("autre")
    expect(typeVenteVersProduitRuche("autre")).toBeNull()
    expect(tauxTvaVenteProduitParDefaut("miel")).toBe(5.5)
    expect(tauxTvaVenteProduitParDefaut("pollen")).toBe(5.5)
    expect(tauxTvaVenteProduitParDefaut("cire")).toBe(20)
    expect(tauxTvaVenteProduitParDefaut("propolis")).toBe(20)
  })
})
