import { describe, expect, it } from "vitest"
import {
  calculerBboxCapture,
  contourEnPixels,
  dimensionsCaptureMetrique,
} from "../satellite-plan-utils"

const geometry = JSON.stringify({
  type: "Polygon",
  coordinates: [[
    [2, 48],
    [2.001, 48],
    [2.001, 48.001],
    [2, 48.001],
    [2, 48],
  ]],
})

describe("capture satellite géoréférencée", () => {
  it("étend la capture aux arbres GPS extérieurs", () => {
    const bbox = calculerBboxCapture(geometry, [{ lat: 48.0005, lng: 2.0015 }], 0)
    expect(bbox).toEqual({ lng1: 2, lat1: 48, lng2: 2.0015, lat2: 48.001 })
  })

  it("conserve une échelle au sol homogène sur les deux axes", () => {
    const dimensions = dimensionsCaptureMetrique({
      lng1: 2,
      lat1: 48,
      lng2: 2.002,
      lat2: 48.001,
    })
    expect(dimensions?.width).toBe(1280)
    expect(dimensions?.height).toBeGreaterThan(900)
    expect(dimensions?.height).toBeLessThan(1000)
  })

  it("projette le nord en haut de l'image", () => {
    const bbox = { lng1: 2, lat1: 48, lng2: 2.001, lat2: 48.001 }
    expect(contourEnPixels(geometry, bbox, 1000, 800)).toEqual([[
      [0, 800],
      [1000, 800],
      [1000, 0],
      [0, 0],
      [0, 800],
    ]])
  })
})
