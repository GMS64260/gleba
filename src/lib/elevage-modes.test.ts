import { describe, it, expect } from "vitest"
import {
  sanitizeModesElevage,
  filieresActives,
  ELEVAGE_MODE_IDS,
  DEFAULT_MODES_ELEVAGE,
} from "@/lib/elevage-modes"

describe("elevage-modes — sanitize", () => {
  it("défaut = aucun mode optionnel (liste vide valide)", () => {
    expect(DEFAULT_MODES_ELEVAGE).toEqual([])
    expect(sanitizeModesElevage(undefined)).toEqual([])
    expect(sanitizeModesElevage(null)).toEqual([])
    // Une chaîne n'est pas un tableau → défaut.
    expect(sanitizeModesElevage("compagnie")).toEqual([])
  })

  it("filtre les valeurs inconnues et dédoublonne", () => {
    expect(sanitizeModesElevage(["compagnie", "x", "compagnie"])).toEqual(["compagnie"])
    expect(new Set(sanitizeModesElevage(["compagnie", "equin", "nac"]))).toEqual(
      new Set(ELEVAGE_MODE_IDS)
    )
    expect(sanitizeModesElevage(["rente"])).toEqual([]) // 'rente' n'est pas un mode optionnel
  })
})

describe("elevage-modes — filieresActives", () => {
  it("inclut toujours 'rente'", () => {
    expect(filieresActives([])).toEqual(["rente"])
    expect(filieresActives(["compagnie"])).toEqual(["rente", "compagnie"])
    expect(filieresActives(["equin", "nac"])).toEqual(["rente", "equin", "nac"])
  })
})
