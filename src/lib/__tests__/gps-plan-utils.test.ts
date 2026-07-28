import { describe, expect, it } from "vitest"
import { fondVersMonde, mondeVersFond } from "../plan-fond-utils"
import { projeterGpsSurPlan, projeterPlanSurGps } from "../gps-plan-utils"

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

// Même ordre de sommets que le GeoJSON ; le nord est en haut de l'image.
const contour = [[
  [0, 800],
  [1000, 800],
  [1000, 0],
  [0, 0],
  [0, 800],
]]

describe("projeterGpsSurPlan", () => {
  it("place le relevé GPS au bon pixel puis dans le repère métrique du fond", () => {
    const position = projeterGpsSurPlan({
      gpsLat: 48.0005,
      gpsLng: 2.0005,
      geometryGeoJson: geometry,
      contour,
      fond: { scale: 0.1, offsetX: 2, offsetY: 3, rotation: 0 },
      imageWidth: 1000,
      imageHeight: 800,
    })

    expect(position?.x).toBeCloseTo(52, 6)
    expect(position?.y).toBeCloseTo(43, 6)
  })

  it("respecte la rotation et le décalage appliqués à l'image", () => {
    const fond = { scale: 0.08, offsetX: -4, offsetY: 7, rotation: 37 }
    const position = projeterGpsSurPlan({
      gpsLat: 48.00075,
      gpsLng: 2.0002,
      geometryGeoJson: geometry,
      contour,
      fond,
      imageWidth: 1000,
      imageHeight: 800,
    })
    const attendu = fondVersMonde({ x: 200, y: 200 }, fond, 1000, 800)

    expect(position?.x).toBeCloseTo(attendu.x, 6)
    expect(position?.y).toBeCloseTo(attendu.y, 6)
  })

  it("tolère l'arrondi au centième de pixel du contour capturé", () => {
    const contourArrondi = contour.map((anneau) =>
      anneau.map(([x, y], index) => [x + (index % 2 ? 0.004 : -0.004), y])
    )
    const position = projeterGpsSurPlan({
      gpsLat: 48.0005,
      gpsLng: 2.0005,
      geometryGeoJson: geometry,
      contour: contourArrondi,
      fond: { scale: 0.1, offsetX: 0, offsetY: 0, rotation: 0 },
      imageWidth: 1000,
      imageHeight: 800,
    })

    expect(position?.x).toBeCloseTo(50, 3)
    expect(position?.y).toBeCloseTo(40, 3)
  })

  it("conserve un arbre proche mais extérieur au contour de la parcelle", () => {
    const position = projeterGpsSurPlan({
      gpsLat: 48.0005,
      gpsLng: 2.0012,
      geometryGeoJson: geometry,
      contour,
      fond: { scale: 0.1, offsetX: 0, offsetY: 0, rotation: 0 },
      imageWidth: 1000,
      imageHeight: 800,
    })

    expect(position?.x).toBeCloseTo(120, 6)
    expect(position?.y).toBeCloseTo(40, 6)
  })

  it("refuse une position très éloignée et un contour sans correspondance", () => {
    const base = {
      geometryGeoJson: geometry,
      fond: { scale: 0.1, offsetX: 0, offsetY: 0, rotation: 0 },
      imageWidth: 1000,
      imageHeight: 800,
    }

    expect(
      projeterGpsSurPlan({ ...base, gpsLat: 43, gpsLng: 3, contour })
    ).toBeNull()
    expect(
      projeterGpsSurPlan({
        ...base,
        gpsLat: 48.0005,
        gpsLng: 2.0005,
        contour: [contour[0].slice(0, -1)],
      })
    ).toBeNull()
  })
})

describe("projeterPlanSurGps", () => {
  it("inverse exactement la projection GPS avec rotation et décalage", () => {
    const fond = { scale: 0.08, offsetX: -4, offsetY: 7, rotation: 37 }
    const position = projeterGpsSurPlan({
      gpsLat: 48.00075,
      gpsLng: 2.0002,
      geometryGeoJson: geometry,
      contour,
      fond,
      imageWidth: 1000,
      imageHeight: 800,
    })

    expect(position).not.toBeNull()
    const gps = projeterPlanSurGps({
      posX: position!.x,
      posY: position!.y,
      geometryGeoJson: geometry,
      contour,
      fond,
      imageWidth: 1000,
      imageHeight: 800,
    })

    expect(gps).toEqual({ gpsLat: 48.00075, gpsLng: 2.0002 })
  })

  it("convertit un déplacement 2D en un nouveau point GPS", () => {
    const gps = projeterPlanSurGps({
      posX: 62,
      posY: 23,
      geometryGeoJson: geometry,
      contour,
      fond: { scale: 0.1, offsetX: 2, offsetY: 3, rotation: 0 },
      imageWidth: 1000,
      imageHeight: 800,
    })

    expect(gps?.gpsLat).toBeCloseTo(48.00075, 7)
    expect(gps?.gpsLng).toBeCloseTo(2.0006, 7)
  })

  it("refuse un point très éloigné de l'image géoréférencée", () => {
    expect(
      projeterPlanSurGps({
        posX: 500,
        posY: 500,
        geometryGeoJson: geometry,
        contour,
        fond: { scale: 0.1, offsetX: 0, offsetY: 0, rotation: 0 },
        imageWidth: 1000,
        imageHeight: 800,
      })
    ).toBeNull()
  })
})

describe("mondeVersFond", () => {
  it("inverse fondVersMonde", () => {
    const fond = { scale: 0.04, offsetX: 3, offsetY: -2, rotation: 91 }
    const pixel = { x: 812.4, y: 107.9 }
    const monde = fondVersMonde(pixel, fond, 1280, 654)

    expect(mondeVersFond(monde, fond, 1280, 654)?.x).toBeCloseTo(pixel.x, 8)
    expect(mondeVersFond(monde, fond, 1280, 654)?.y).toBeCloseTo(pixel.y, 8)
  })
})
