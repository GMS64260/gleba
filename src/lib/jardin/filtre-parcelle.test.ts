import { describe, expect, it } from "vitest"
import { parcelleDeCreation } from "./filtre-parcelle"

/**
 * PLAN-02 (revue Codex du 2026-11-12) : le filtre « Non assigné » du plan vaut
 * 'none'. `selectedParcelleId || undefined` le transmettait tel quel à la
 * création d'un objet ou d'un arbre, et la route cherchait une parcelle d'id
 * 'none' : 400 (objet) ou 404 (arbre), aucune création possible dans ce filtre.
 */
describe("parcelleDeCreation", () => {
  it("« Non assigné » ne désigne aucune parcelle", () => {
    expect(parcelleDeCreation("none")).toBeUndefined()
  })

  it("« Toutes les parcelles » (null) et vide : aucune parcelle imposée", () => {
    expect(parcelleDeCreation(null)).toBeUndefined()
    expect(parcelleDeCreation(undefined)).toBeUndefined()
    expect(parcelleDeCreation("")).toBeUndefined()
  })

  it("une parcelle choisie passe telle quelle", () => {
    expect(parcelleDeCreation("cm1parcelle")).toBe("cm1parcelle")
  })
})
