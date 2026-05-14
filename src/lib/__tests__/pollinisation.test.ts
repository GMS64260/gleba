import { describe, it, expect } from "vitest"
import {
  isTriploide,
  groupesCompatibles,
  analyserPollinisationTriploide,
  distanceMetres,
  DISTANCE_MAX_POLLINISATION_M,
} from "../pollinisation"

describe("pollinisation", () => {
  describe("isTriploide", () => {
    it("détecte via la colonne ploidie", () => {
      expect(isTriploide({ ploidie: "Triploïde" })).toBe(true)
      expect(isTriploide({ ploidie: "Diploïde" })).toBe(false)
    })

    it("fallback sur la liste des variétés connues", () => {
      expect(isTriploide({ nomNormalise: "belle de boskoop" })).toBe(true)
      expect(isTriploide({ nomNormalise: "JONAGOLD" })).toBe(true)
      expect(isTriploide({ nomNormalise: "gala" })).toBe(false)
    })

    it("retourne false si null", () => {
      expect(isTriploide(null)).toBe(false)
    })
  })

  describe("groupesCompatibles", () => {
    it("même groupe = compatible", () => {
      expect(groupesCompatibles("B", "B")).toBe(true)
    })
    it("groupes adjacents = compatibles", () => {
      expect(groupesCompatibles("A", "B")).toBe(true)
      expect(groupesCompatibles("B", "C")).toBe(true)
      expect(groupesCompatibles("C", "D")).toBe(true)
    })
    it("groupes non adjacents = non compatibles", () => {
      expect(groupesCompatibles("A", "C")).toBe(false)
      expect(groupesCompatibles("A", "D")).toBe(false)
    })
    it("permissif si inconnu", () => {
      expect(groupesCompatibles(null, "A")).toBe(true)
    })
  })

  describe("analyserPollinisationTriploide", () => {
    it("OK si 2 diploïdes compatibles", () => {
      const r = analyserPollinisationTriploide(
        { groupePollinisation: "B" },
        [
          { ploidie: "Diploïde", groupePollinisation: "B" },
          { ploidie: "Diploïde", groupePollinisation: "A" },
        ]
      )
      expect(r.ok).toBe(true)
      expect(r.pollinisateursOK).toBe(2)
    })

    it("KO si 1 seul diploïde", () => {
      const r = analyserPollinisationTriploide(
        { groupePollinisation: "B" },
        [{ ploidie: "Diploïde", groupePollinisation: "B" }]
      )
      expect(r.ok).toBe(false)
      expect(r.manquant).toBe(1)
    })

    it("KO si voisin est triploïde (ne pollinise pas)", () => {
      const r = analyserPollinisationTriploide(
        { groupePollinisation: "B" },
        [{ ploidie: "Triploïde", groupePollinisation: "B" }]
      )
      expect(r.ok).toBe(false)
      expect(r.pollinisateursOK).toBe(0)
    })

    it("KO si groupes non compatibles", () => {
      const r = analyserPollinisationTriploide(
        { groupePollinisation: "A" },
        [{ ploidie: "Diploïde", groupePollinisation: "D" }] // A vs D non adjacent
      )
      expect(r.ok).toBe(false)
    })
  })

  describe("distanceMetres", () => {
    it("retourne Infinity si coordonnées manquantes", () => {
      expect(distanceMetres({}, { latitude: 45, longitude: 1 })).toBe(Infinity)
    })

    it("calcule une distance plausible (~111 km pour 1°)", () => {
      const d = distanceMetres({ latitude: 45, longitude: 1 }, { latitude: 46, longitude: 1 })
      expect(d).toBeGreaterThan(100000)
      expect(d).toBeLessThan(115000)
    })
  })

  it("DISTANCE_MAX_POLLINISATION_M = 30", () => {
    expect(DISTANCE_MAX_POLLINISATION_M).toBe(30)
  })
})
