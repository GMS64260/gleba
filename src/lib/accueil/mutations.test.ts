import { describe, expect, it } from "vitest"

import { mutationEtapeCulture } from "./mutations"

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
})
