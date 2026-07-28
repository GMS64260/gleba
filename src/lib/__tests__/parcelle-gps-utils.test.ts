import { describe, expect, it } from "vitest"
import {
  distancePointParcelleMetres,
  trouverParcelleGpsProche,
} from "../parcelle-gps-utils"

const jardin = {
  id: "jardin",
  geometry: JSON.stringify({
    type: "Polygon",
    coordinates: [[
      [-0.331835, 43.112204],
      [-0.331805, 43.112061],
      [-0.331403, 43.11207],
      [-0.33147, 43.11227],
      [-0.331835, 43.112204],
    ]],
  }),
}

describe("association GPS à une parcelle", () => {
  it("retourne zéro à l'intérieur du polygone", () => {
    expect(
      distancePointParcelleMetres({
        lat: 43.11215,
        lng: -0.3316,
        geometryGeoJson: jardin.geometry,
      })
    ).toBe(0)
  })

  it("associe les relevés proches du contour à la parcelle la plus proche", () => {
    const parcelle = trouverParcelleGpsProche(
      [
        jardin,
        {
          id: "loin",
          geometry: JSON.stringify({
            type: "Polygon",
            coordinates: [[
              [-0.34, 43.11],
              [-0.339, 43.11],
              [-0.339, 43.111],
              [-0.34, 43.111],
              [-0.34, 43.11],
            ]],
          }),
        },
      ],
      43.112232,
      -0.331372
    )

    expect(parcelle?.id).toBe("jardin")
  })

  it("ne rattache pas automatiquement un relevé éloigné", () => {
    expect(trouverParcelleGpsProche([jardin], 43.113, -0.33)).toBeNull()
  })
})
