import { describe, it, expect } from "vitest"
import { labelStatutRecolteArbre } from "../statut-recolte-arbre"

describe("labelStatutRecolteArbre (ticket cmv292iae)", () => {
  it("rend « En stock » et non le code en_stock", () => {
    expect(labelStatutRecolteArbre("en_stock")).toBe("En stock")
  })

  it("couvre les quatre statuts du schéma", () => {
    expect(labelStatutRecolteArbre("vendu")).toBe("Vendu")
    expect(labelStatutRecolteArbre("consomme")).toBe("Usage interne")
    expect(labelStatutRecolteArbre("perte")).toBe("Perte")
  })

  it("un statut absent vaut le défaut du schéma", () => {
    expect(labelStatutRecolteArbre(null)).toBe("En stock")
    expect(labelStatutRecolteArbre("")).toBe("En stock")
  })

  it("un code inconnu n'affiche jamais de tiret bas", () => {
    expect(labelStatutRecolteArbre("en_transformation")).toBe("en transformation")
  })
})
