import { describe, expect, it } from "vitest"
import { decalerGeometrieParcelle, nomCopieParcelle } from "./geo-duplication"

const carre = JSON.stringify({
  type: "Polygon",
  coordinates: [[[2.0, 48.0], [2.001, 48.0], [2.001, 48.001], [2.0, 48.001], [2.0, 48.0]]],
})

describe("decalerGeometrieParcelle", () => {
  it("pose la copie à l'est, décalée de sa largeur plus 10 %, latitudes intactes", () => {
    const copie = JSON.parse(decalerGeometrieParcelle(carre)!)
    const original = JSON.parse(carre)
    expect(copie.type).toBe("Polygon")
    copie.coordinates[0].forEach((p: [number, number], i: number) => {
      expect(p[0]).toBeCloseTo(original.coordinates[0][i][0] + 0.0011, 9)
      expect(p[1]).toBe(original.coordinates[0][i][1])
    })
  })

  it("gère un MultiPolygon et conserve sa structure", () => {
    const multi = JSON.stringify({
      type: "MultiPolygon",
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[3, 0], [4, 0], [4, 1], [3, 0]]]],
    })
    const copie = JSON.parse(decalerGeometrieParcelle(multi)!)
    expect(copie.coordinates).toHaveLength(2)
    // largeur totale 4 → décalage 4,4
    expect(copie.coordinates[0][0][0]).toEqual([4.4, 0])
    expect(copie.coordinates[1][0][1]).toEqual([8.4, 0])
  })

  it("refuse ce qui n'est pas un polygone exploitable", () => {
    expect(decalerGeometrieParcelle("pas du json")).toBeNull()
    expect(decalerGeometrieParcelle(JSON.stringify({ type: "Point", coordinates: [1, 2] }))).toBeNull()
    expect(decalerGeometrieParcelle(JSON.stringify({ type: "Polygon", coordinates: [[[1, 1], [1, 1]]] }))).toBeNull()
    expect(decalerGeometrieParcelle(JSON.stringify({ type: "Polygon", coordinates: [[["a", 1]]] }))).toBeNull()
  })
})

describe("nomCopieParcelle", () => {
  it("numérote les copies sans jamais reprendre un nom pris", () => {
    expect(nomCopieParcelle("Tunnel 1", ["Tunnel 1"])).toBe("Tunnel 1 (copie)")
    expect(nomCopieParcelle("Tunnel 1", ["Tunnel 1", "tunnel 1 (copie)"])).toBe("Tunnel 1 (copie 2)")
    expect(nomCopieParcelle("Tunnel 1 (copie)", ["Tunnel 1", "Tunnel 1 (copie)"])).toBe("Tunnel 1 (copie 2)")
    expect(nomCopieParcelle("   ", [])).toBe("Parcelle (copie)")
  })
})
