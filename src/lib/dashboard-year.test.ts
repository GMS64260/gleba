import { describe, expect, it } from "vitest"

import { resolveDashboardYear } from "./dashboard-year"

describe("resolveDashboardYear", () => {
  it("donne la priorité à l'année du deep-link", () => {
    expect(resolveDashboardYear({
      queryValue: "2027",
      storedValue: "2026",
      fallbackYear: 2025,
    })).toBe(2027)
  })

  it("reprend l'année mémorisée quand le deep-link n'en fournit pas", () => {
    expect(resolveDashboardYear({
      storedValue: "2027",
      fallbackYear: 2026,
      allowedYears: [2027, 2026, 2025],
    })).toBe(2027)
  })

  it("ignore les valeurs invalides ou hors de la plage du sélecteur", () => {
    expect(resolveDashboardYear({
      queryValue: "2027-test",
      storedValue: "2020",
      fallbackYear: 2026,
      allowedYears: [2027, 2026, 2025],
    })).toBe(2026)
  })
})
