import { describe, expect, it } from "vitest"
import {
  calculerRappelsIrrigationsEnRetard,
  creerCleRappelIrrigation,
} from "./detect"
import type { IrrigationRetardInput, MeteoIrrigationRetard } from "./detect"

const REFERENCE = new Date(2026, 7, 13, 12, 0, 0)
const COORDONNEE = { lat: 48.1, lng: 2.3 }
const CLE_COORDONNEE = "4810_230"

function meteoSansPluie(): MeteoIrrigationRetard {
  return {
    precipParCoordEtJour: new Map([[CLE_COORDONNEE, new Map()]]),
    pluieRecente3jParCoord: new Map([[CLE_COORDONNEE, 0]]),
  }
}

function irrigation(overrides: Partial<IrrigationRetardInput> = {}): IrrigationRetardInput {
  return {
    id: 42,
    fait: false,
    datePrevue: new Date(2026, 7, 12, 9, 0, 0),
    especeNom: "Tomate",
    varieteNom: "Cerise",
    plancheNom: "S4",
    lat: null,
    lng: null,
    ...overrides,
  }
}

describe("calculerRappelsIrrigationsEnRetard", () => {
  it("détecte une irrigation échue et construit son message", () => {
    const rappels = calculerRappelsIrrigationsEnRetard([irrigation()], meteoSansPluie(), {
      aujourdHui: REFERENCE,
    })

    expect(rappels).toHaveLength(1)
    expect(rappels[0]).toMatchObject({
      type: "irrigation-rappel",
      titre: "Tomate (Cerise) — planche S4",
      key: "irrigation-rappel:42:2026-08-13",
    })
    expect(rappels[0].message).toContain("prévue le 12/08/2026")
    expect(rappels[0].message).toContain("1 jour de retard")
  })

  it("ignore une irrigation faite et une irrigation future", () => {
    const rappels = calculerRappelsIrrigationsEnRetard(
      [
        irrigation({ id: 1, fait: true }),
        irrigation({ id: 2, datePrevue: new Date(2026, 7, 14, 9) }),
      ],
      meteoSansPluie(),
      { aujourdHui: REFERENCE }
    )

    expect(rappels).toHaveLength(0)
  })

  it("ignore une irrigation échue probablement inutile à cause de la pluie prévue", () => {
    const meteo: MeteoIrrigationRetard = {
      precipParCoordEtJour: new Map([
        [CLE_COORDONNEE, new Map([["2026-08-12", 6]])],
      ]),
      pluieRecente3jParCoord: new Map([[CLE_COORDONNEE, 0]]),
    }

    const rappels = calculerRappelsIrrigationsEnRetard(
      [irrigation({ lat: COORDONNEE.lat, lng: COORDONNEE.lng })],
      meteo,
      { aujourdHui: REFERENCE }
    )

    expect(rappels).toHaveLength(0)
  })

  it("utilise une clé quotidienne stable par irrigation", () => {
    expect(creerCleRappelIrrigation(123, REFERENCE)).toBe("irrigation-rappel:123:2026-08-13")
    expect(creerCleRappelIrrigation(123, new Date(2026, 7, 14))).toBe(
      "irrigation-rappel:123:2026-08-14"
    )
  })

  it("limite à cinq rappels et conserve les irrigations les plus anciennes", () => {
    const irrigations = Array.from({ length: 7 }, (_, index) =>
      irrigation({
        id: index + 1,
        datePrevue: new Date(2026, 7, 12 - index, 9),
        lat: null,
        lng: null,
      })
    )

    const rappels = calculerRappelsIrrigationsEnRetard(irrigations, meteoSansPluie(), {
      aujourdHui: REFERENCE,
    })

    expect(rappels).toHaveLength(5)
    expect(rappels.map((rappel) => rappel.key)).toEqual([
      "irrigation-rappel:7:2026-08-13",
      "irrigation-rappel:6:2026-08-13",
      "irrigation-rappel:5:2026-08-13",
      "irrigation-rappel:4:2026-08-13",
      "irrigation-rappel:3:2026-08-13",
    ])
  })
})
