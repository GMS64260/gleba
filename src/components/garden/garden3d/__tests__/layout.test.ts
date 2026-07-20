import { describe, expect, it } from "vitest"
import * as THREE from "three"

import { computeFondCorners, computeLayout } from "../layout"
import type { Garden3DData, Garden3DFond } from "../types"

const empty: Garden3DData = { planches: [], objets: [], arbres: [] }

describe("computeLayout 3D", () => {
  it("inclut les dimensions métriques et le décalage du fond", () => {
    const fond: Garden3DFond = {
      image: "data:image/png;base64,x",
      imageWidth: 200,
      imageHeight: 100,
      scale: 0.1,
      offsetX: 10,
      offsetY: 20,
      rotation: 0,
      opacity: 0.5,
    }
    expect(computeLayout(empty, fond)).toEqual({ cx: 20, cz: 25, size: 20 })
  })

  it("agrandit les bornes pour un fond tourné autour de son centre", () => {
    const fond: Garden3DFond = {
      image: "data:image/png;base64,x",
      imageWidth: 200,
      imageHeight: 100,
      scale: 0.1,
      offsetX: 0,
      offsetY: 0,
      rotation: 90,
      opacity: 1,
    }
    expect(computeLayout(empty, fond)).toEqual({ cx: 10, cz: 5, size: 20 })
  })

  it("conserve le plan horizontal et aligne ses coins après rotation", () => {
    const fond: Garden3DFond = {
      image: "data:image/png;base64,x",
      imageWidth: 4,
      imageHeight: 2,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 90,
      opacity: 1,
    }

    const normal = new THREE.Vector3(0, 0, 1)
      .applyEuler(new THREE.Euler(Math.PI / 2, 0, 0))
      .applyEuler(new THREE.Euler(0, -Math.PI / 2, 0))

    expect(normal.x).toBeCloseTo(0)
    expect(normal.y).toBeCloseTo(-1)
    expect(normal.z).toBeCloseTo(0)
    const corners = computeFondCorners(fond)
    ;[
      [3, -1],
      [3, 3],
      [1, 3],
      [1, -1],
    ].forEach(([x, z], index) => {
      expect(corners[index][0]).toBeCloseTo(x)
      expect(corners[index][1]).toBeCloseTo(z)
    })
  })
})
