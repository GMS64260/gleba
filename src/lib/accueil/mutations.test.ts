import { describe, expect, it } from "vitest"

import { mutationEtapeCulture, mutationIrrigationFaite } from "./mutations"

describe("mutations des lignes du jour", () => {
  it("une étape de culture a un inverse exact", () => {
    const m = mutationEtapeCulture(42, "semis", "Radis · B1")
    expect(m.url).toBe("/api/cultures/42")
    expect(m.corps).toEqual({ semisFait: true })
    expect(m.inverse).toEqual({ semisFait: false })
    expect(m.titre).toBe("Semis noté")
    expect(m.detail).toBe("Radis · B1")
    expect(mutationEtapeCulture(7, "plantation").corps).toEqual({ plantationFaite: true })
  })

  it("un arrosage planifié se note et s'annule avec sa date effective", () => {
    const m = mutationIrrigationFaite(9)
    expect(m.url).toBe("/api/irrigations/9")
    expect(m.corps).toEqual({ fait: true })
    expect(m.inverse).toEqual({ fait: false, dateEffective: null })
  })
})
