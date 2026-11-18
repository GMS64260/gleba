import { describe, it, expect } from "vitest"
import { isAutofertileFallback, doitSignalerSansPollinisateur } from "../pollinisation"

describe("pollinisation", () => {
  describe("isAutofertileFallback", () => {
    it.each(["Mirabelle de Nancy", "  STELLA  ", "Reine-Claude d'Oullins"])("reconnaît la variété autofertile %s", (nom) => {
      expect(isAutofertileFallback(nom)).toBe(true)
    })

    it.each([null, undefined, "", "Williams", "Conférence", "Golden Delicious"])("ne présume pas l'autofertilité pour %s", (nom) => {
      expect(isAutofertileFallback(nom)).toBe(false)
    })
  })

  describe("doitSignalerSansPollinisateur", () => {
    it("signale une variété anémophile sans pollinisateur variétal", () => {
      expect(
        doitSignalerSansPollinisateur({
          autofertile: false,
          nombrePollinisateursExplicites: 0,
          hasPollinisateurDerive: false,
          modePollinisation: "anémophile",
        })
      ).toBe(true)
    })

    it("ne signale pas un arbre avec un pollinisateur compatible", () => {
      expect(
        doitSignalerSansPollinisateur({
          autofertile: false,
          nombrePollinisateursExplicites: 1,
          hasPollinisateurDerive: false,
          modePollinisation: "anémophile",
        })
      ).toBe(false)
    })
  })
})
