import { describe, it, expect } from "vitest"
import {
  calibrerFond,
  distance,
  fondVersMonde,
  formatDistance,
  type FondReglages,
} from "../plan-fond-utils"

describe("plan-fond-utils", () => {
  describe("formatDistance", () => {
    it("affiche en cm sous le mètre", () => {
      expect(formatDistance(0.82)).toBe("82 cm")
      expect(formatDistance(0.05)).toBe("5 cm")
    })
    it("affiche en mètres avec virgule française", () => {
      expect(formatDistance(4.25)).toBe("4,25 m")
      expect(formatDistance(12)).toBe("12 m")
    })
    it("gère les valeurs invalides", () => {
      expect(formatDistance(NaN)).toBe("–")
      expect(formatDistance(-1)).toBe("–")
    })
  })

  describe("calibrerFond", () => {
    const image = { imageWidth: 1000, imageHeight: 800 }

    it("recalcule l'échelle sans rotation", () => {
      const fond: FondReglages = { scale: 0.1, offsetX: 2, offsetY: 3, rotation: 0 }
      // Deux points séparés de 4 m sur le plan, distance réelle 8 m → échelle ×2
      const res = calibrerFond({
        p1: { x: 5, y: 3 },
        p2: { x: 5, y: 7 },
        distanceReelle: 8,
        fond,
        ...image,
      })
      expect(res).not.toBeNull()
      expect(res!.scale).toBeCloseTo(0.2, 10)
      // Le premier point reste ancré : (5,3) était le pixel image (30,0)
      expect(res!.offsetX).toBeCloseTo(-1, 10)
      expect(res!.offsetY).toBeCloseTo(3, 10)
    })

    it("ancre le premier point et respecte la distance, même avec rotation", () => {
      const fond: FondReglages = { scale: 0.05, offsetX: -4, offsetY: 7, rotation: 37 }
      const p1 = { x: 3.2, y: 5.9 }
      const p2 = { x: 11.7, y: 1.4 }
      const distanceReelle = 25

      const res = calibrerFond({ p1, p2, distanceReelle, fond, ...image })
      expect(res).not.toBeNull()
      const fond2: FondReglages = { ...res!, rotation: fond.rotation }

      // Retrouver les pixels image des deux points avec les anciens réglages,
      // puis vérifier leur position monde avec les nouveaux.
      const versImage = (p: { x: number; y: number }, f: FondReglages) => {
        const theta = (-f.rotation * Math.PI) / 180
        const c = { x: (image.imageWidth * f.scale) / 2, y: (image.imageHeight * f.scale) / 2 }
        const dx = p.x - f.offsetX - c.x
        const dy = p.y - f.offsetY - c.y
        return {
          x: (c.x + dx * Math.cos(theta) - dy * Math.sin(theta)) / f.scale,
          y: (c.y + dx * Math.sin(theta) + dy * Math.cos(theta)) / f.scale,
        }
      }
      const p1Img = versImage(p1, fond)
      const p2Img = versImage(p2, fond)

      const p1Apres = fondVersMonde(p1Img, fond2, image.imageWidth, image.imageHeight)
      const p2Apres = fondVersMonde(p2Img, fond2, image.imageWidth, image.imageHeight)

      // p1 immobile, et la distance p1–p2 devient la distance réelle saisie
      expect(p1Apres.x).toBeCloseTo(p1.x, 8)
      expect(p1Apres.y).toBeCloseTo(p1.y, 8)
      expect(distance(p1Apres, p2Apres)).toBeCloseTo(distanceReelle, 8)
    })

    it("refuse les points confondus ou une distance nulle", () => {
      const fond: FondReglages = { scale: 0.1, offsetX: 0, offsetY: 0, rotation: 0 }
      expect(
        calibrerFond({ p1: { x: 1, y: 1 }, p2: { x: 1, y: 1 }, distanceReelle: 5, fond, ...image })
      ).toBeNull()
      expect(
        calibrerFond({ p1: { x: 0, y: 0 }, p2: { x: 4, y: 0 }, distanceReelle: 0, fond, ...image })
      ).toBeNull()
    })
  })
})
