import { describe, expect, it } from "vitest"
import { whereArrosageNote } from "../arrosages-notes"

describe("whereArrosageNote", () => {
  it("ne retient que les arrosages faits, hors auto-validations, sans perdre ceux sans observation", () => {
    expect(whereArrosageNote()).toEqual({
      fait: true,
      // Un NOT seul écarterait les notes NULL (vrais arrosages sans observation).
      OR: [{ notes: null }, { NOT: { notes: { startsWith: "Auto-valid" } } }],
    })
  })
})
