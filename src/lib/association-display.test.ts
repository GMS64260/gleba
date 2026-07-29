import { describe, expect, it } from "vitest"
import { associationDetailTitle } from "./association-display"

describe("associationDetailTitle", () => {
  it("ne présente jamais une incompatibilité comme favorable", () => {
    expect(associationDetailTitle("incompatible", false)).toBe("Association incompatible")
    expect(associationDetailTitle("incompatible", true)).toBe("Association incompatible")
  })

  it("distingue les associations favorables requises et facultatives", () => {
    expect(associationDetailTitle("favorable", true)).toBe("Association requise")
    expect(associationDetailTitle("favorable", false)).toBe("Association favorable")
  })
})
