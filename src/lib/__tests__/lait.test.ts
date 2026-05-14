import { describe, it, expect } from "vitest"
import { isoWeek, dim, courbeLactation, tauxPonteSaisonnalise, COEF_PONTE_MOIS } from "../lait"

describe("lait", () => {
  describe("isoWeek", () => {
    it("retourne la semaine ISO d'une date connue", () => {
      // 6 janvier 2026 (mardi) = semaine 2 de 2026
      const r = isoWeek(new Date("2026-01-06"))
      expect(r.year).toBe(2026)
      expect(r.week).toBe(2)
    })

    it("traite correctement le 1er janvier qui appartient à l'année précédente", () => {
      // 1er janvier 2027 (vendredi) = semaine 53 de 2026 (selon ISO 8601)
      const r = isoWeek(new Date("2027-01-01"))
      expect(r.year).toBe(2026)
      expect(r.week).toBe(53)
    })
  })

  describe("dim", () => {
    it("calcule les jours depuis la mise-bas", () => {
      const naissance = new Date("2026-01-01")
      const observation = new Date("2026-01-31") // 30 jours après
      expect(dim(naissance, observation)).toBe(30)
    })
  })

  describe("courbeLactation", () => {
    it("agrège les collectes par jour et calcule la moyenne 7j", () => {
      const dateMb = new Date("2026-01-01")
      const collectes = [
        { date: new Date("2026-01-02"), quantiteLitres: 2.5 },
        { date: new Date("2026-01-02"), quantiteLitres: 2.0 }, // matin + soir
        { date: new Date("2026-01-03"), quantiteLitres: 5.0 },
      ]
      const courbe = courbeLactation(collectes, dateMb)
      expect(courbe.length).toBeGreaterThan(0)
      // J0 (date origine) volume 0, J1 volume 4.5
      const j1 = courbe.find((c) => c.dim === 1)
      expect(j1?.volume).toBeCloseTo(4.5, 1)
    })
  })

  describe("tauxPonteSaisonnalise", () => {
    it("calcule le taux observé", () => {
      // 10 pondeuses × 30 jours × 0,8 œuf/jour = 240 œufs
      const start = new Date("2026-04-01")
      const end = new Date("2026-05-01")
      const r = tauxPonteSaisonnalise(240, 10, start, end)
      expect(r.tauxObserve).toBeGreaterThan(70)
      expect(r.tauxObserve).toBeLessThan(85)
    })

    it("retourne 0 si pas de pondeuses", () => {
      const r = tauxPonteSaisonnalise(100, 0, new Date("2026-01-01"), new Date("2026-01-31"))
      expect(r.tauxObserve).toBe(0)
    })

    it("coefs ponte couvrent 12 mois avec moyenne ~1", () => {
      const somme = Object.values(COEF_PONTE_MOIS).reduce((a, b) => a + b, 0)
      expect(somme / 12).toBeGreaterThan(0.9)
      expect(somme / 12).toBeLessThan(1.1)
    })
  })
})
