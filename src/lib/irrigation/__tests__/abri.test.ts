/**
 * Type d'abri d'une planche (ticket QA cmv3ja7nr) : une seule règle pour les
 * écrans d'arrosage et de pluviométrie, « inconnu » distinct du plein champ.
 */
import { describe, expect, it } from "vitest"

import { estSousAbri, typeSousAbri } from "../abri"

describe("typeSousAbri", () => {
  it("serre, tunnel, châssis sous abri ; plein champ non ; type absent inconnu", () => {
    for (const t of ["Serre", "Tunnel", "Châssis", "Chassis", "tunnel nantais", "Sous abri", "Serre hors-sol", "Serre plein sol", "Tunnel sans chauffage"]) {
      expect(typeSousAbri(t)).toBe(true)
    }
    for (const t of ["Plein champ", "Hors abri", "sans abri", "Plein air"]) expect(typeSousAbri(t)).toBe(false)
    for (const t of [null, undefined, "", "  "]) expect(typeSousAbri(t)).toBeNull()
    expect(estSousAbri(null)).toBe(false)
    expect(estSousAbri("Serre")).toBe(true)
  })
})
