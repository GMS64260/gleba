import { describe, expect, it } from "vitest"
import { associationDetailTitle } from "./association-display"

describe("associationDetailTitle", () => {
  it("ne présente jamais une incompatibilité comme favorable", () => {
    expect(associationDetailTitle("incompatible", false)).toBe("Association incompatible")
    expect(associationDetailTitle("incompatible", true)).toBe("Association incompatible")
  })

  it("nomme le pivot d'une association favorable sans parler d'obligation", () => {
    expect(associationDetailTitle("favorable", true)).toBe("Espèce pivot (association favorable)")
    expect(associationDetailTitle("favorable", false)).toBe("Association favorable")
  })
})
