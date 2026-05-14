import { describe, it, expect } from "vitest"
import {
  isTriploide,
  groupesCompatibles,
  analyserPollinisationTriploide,
  analyserPollinisationArbre,
  distanceMetres,
  DISTANCE_MAX_POLLINISATION_M,
  DISTANCE_ALERTE_POLLINISATION_M,
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

  // DEV3 #8 — Audit Marc 2026-05-14
  describe("analyserPollinisationArbre (statut gradué + distance Haversine)", () => {
    it("Diploïde + 1 pollinisateur compatible proche → suffisant", () => {
      const r = analyserPollinisationArbre(
        { id: 1, ploidie: "Diploïde", groupePollinisation: "B", gpsLat: 45, gpsLng: 1 },
        [{ id: 2, ploidie: "Diploïde", groupePollinisation: "C", gpsLat: 45.0001, gpsLng: 1 }]
      )
      expect(r.statut).toBe("suffisant")
      expect(r.minRequis).toBe(1)
      expect(r.estTriploide).toBe(false)
    })

    it("Triploïde + 2 pollinisateurs compatibles proches → suffisant", () => {
      const r = analyserPollinisationArbre(
        { id: 1, ploidie: "Triploïde", groupePollinisation: "B", gpsLat: 45, gpsLng: 1 },
        [
          { id: 2, ploidie: "Diploïde", groupePollinisation: "A", gpsLat: 45.0001, gpsLng: 1 },
          { id: 3, ploidie: "Diploïde", groupePollinisation: "C", gpsLat: 45.0002, gpsLng: 1 },
        ]
      )
      expect(r.statut).toBe("suffisant")
      expect(r.minRequis).toBe(2)
      expect(r.estTriploide).toBe(true)
    })

    it("Triploïde + 1 pollinisateur seulement → insuffisant", () => {
      const r = analyserPollinisationArbre(
        { id: 1, ploidie: "Triploïde", groupePollinisation: "B" },
        [{ id: 2, ploidie: "Diploïde", groupePollinisation: "A" }]
      )
      expect(r.statut).toBe("insuffisant")
      expect(r.pollinisateursOK).toBe(1)
    })

    it("Aucun pollinisateur compatible → aucun", () => {
      const r = analyserPollinisationArbre(
        { id: 1, ploidie: "Triploïde", groupePollinisation: "A" },
        [{ id: 2, ploidie: "Triploïde", groupePollinisation: "A" }] // triploïde, ne pollinise pas
      )
      expect(r.statut).toBe("aucun")
    })

    it("Pollinisateur > 50 m → alerte distance, rétrograde le statut", () => {
      // 0.001° de latitude ≈ 111 m → au-delà du seuil 50 m
      const r = analyserPollinisationArbre(
        { id: 1, ploidie: "Diploïde", groupePollinisation: "B", gpsLat: 45, gpsLng: 1 },
        [{ id: 2, ploidie: "Diploïde", groupePollinisation: "B", gpsLat: 45.001, gpsLng: 1 }]
      )
      expect(r.statut).toBe("aucun") // 0 dans le seuil
      expect(r.alerteDistance).toBe(true)
      expect(r.pollinisateursCompatibles).toHaveLength(1)
      expect(r.pollinisateursCompatibles[0].distanceM).toBeGreaterThan(50)
    })

    it("Triploïde : 2 pollis compatibles, 1 proche + 1 lointain → insuffisant", () => {
      const r = analyserPollinisationArbre(
        { id: 1, ploidie: "Triploïde", groupePollinisation: "B", gpsLat: 45, gpsLng: 1 },
        [
          { id: 2, ploidie: "Diploïde", groupePollinisation: "B", gpsLat: 45.0001, gpsLng: 1 }, // ~11m proche
          { id: 3, ploidie: "Diploïde", groupePollinisation: "B", gpsLat: 45.001, gpsLng: 1 },  // ~111m loin
        ]
      )
      expect(r.statut).toBe("insuffisant") // 1 dans seuil, besoin 2
      expect(r.alerteDistance).toBe(true)
    })

    it("Pas de GPS → distance non calculée, fallback sur compatibilité seule", () => {
      const r = analyserPollinisationArbre(
        { id: 1, ploidie: "Diploïde", groupePollinisation: "B" },
        [{ id: 2, ploidie: "Diploïde", groupePollinisation: "B" }]
      )
      expect(r.statut).toBe("suffisant")
      expect(r.pollinisateursCompatibles[0].distanceM).toBeNull()
    })
  })

  it("DISTANCE_ALERTE_POLLINISATION_M = 50", () => {
    expect(DISTANCE_ALERTE_POLLINISATION_M).toBe(50)
  })
})
