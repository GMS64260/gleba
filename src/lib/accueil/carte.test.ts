import { describe, expect, it } from "vitest"

import { projeterParcelles } from "./carte"

const carre = (x: number, y: number, c: number) =>
  JSON.stringify({ type: "Polygon", coordinates: [[[x, y], [x + c, y], [x + c, y + c], [x, y + c], [x, y]]] })

describe("projeterParcelles", () => {
  it("ajuste le cadre aux parcelles avec la marge, le nord en haut", () => {
    const v = projeterParcelles(
      [{ id: "a", nom: "A", geometry: carre(-0.5, 45, 0.01), couleur: "#abc", surfaceHa: 1, usage: null }],
      { largeur: 200, hauteur: 100, marge: 10 },
    )
    expect(v.formes).toHaveLength(1)
    expect(v.formes[0].anneaux).toHaveLength(1)
    const pts = v.formes[0].anneaux[0].split(" ").map((p) => p.split(",").map(Number))
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(10)
    expect(Math.max(...xs)).toBeLessThanOrEqual(190)
    expect(Math.min(...ys)).toBeCloseTo(10, 0)
    expect(Math.max(...ys)).toBeCloseTo(90, 0)
    // Le premier point (sud-ouest) est en bas à gauche.
    expect(pts[0][1]).toBeGreaterThan(pts[2][1])
  })

  it("lit un MultiPolygon, ignore une géométrie illisible, et rend une vignette vide sans parcelle", () => {
    const multi = JSON.stringify({ type: "MultiPolygon", coordinates: [JSON.parse(carre(0, 0, 1)).coordinates, JSON.parse(carre(2, 0, 1)).coordinates] })
    const v = projeterParcelles([
      { id: "m", nom: "M", geometry: multi, couleur: null, surfaceHa: null, usage: null },
      { id: "x", nom: "X", geometry: "pas du json", couleur: null, surfaceHa: null, usage: null },
    ])
    expect(v.formes.map((f) => f.id)).toEqual(["m"])
    expect(v.formes[0].anneaux).toHaveLength(2)
    expect(projeterParcelles([]).formes).toEqual([])
  })
})
