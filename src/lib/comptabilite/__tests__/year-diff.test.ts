import { describe, it, expect } from "vitest"
import { computeYearDiff } from "../year-diff"

describe("computeYearDiff", () => {
  it("N-1 > 0 → state=compare avec pourcentage", () => {
    const r = computeYearDiff({ revenus: 1500, revenusAnneePrecedente: 1000 })
    expect(r.state).toBe("compare")
    expect(r.diff).toBe(500)
    expect(r.percent).toBe(50)
  })

  it("N-1 > 0 et N en baisse → percent négatif", () => {
    const r = computeYearDiff({ revenus: 800, revenusAnneePrecedente: 1000 })
    expect(r.state).toBe("compare")
    expect(r.percent).toBe(-20)
  })

  it("N-1 = 0 et N > 0 → state=nouveau (avant : indisponible à tort)", () => {
    const r = computeYearDiff({ revenus: 1200, revenusAnneePrecedente: 0 })
    expect(r.state).toBe("nouveau")
    expect(r.diff).toBe(1200)
    expect(r.percent).toBe(0)
  })

  it("N-1 = 0 et N = 0 → state=vide", () => {
    const r = computeYearDiff({ revenus: 0, revenusAnneePrecedente: 0 })
    expect(r.state).toBe("vide")
  })

  it("Bug COMPTA #2 : revenus N-1 = 0 mais dépenses N-1 > 0 → nouveau-revenus (et pas 'pas d'activité')", () => {
    // Cas réel : « Achat lot Solognote » 3 300 € en 2025, 0 € de revenus 2025.
    const r = computeYearDiff({
      revenus: 5000,
      revenusAnneePrecedente: 0,
      depensesAnneePrecedente: 3300,
    })
    expect(r.state).toBe("nouveau-revenus")
    expect(r.depensesPrecedente).toBe(3300)
    expect(r.percent).toBe(0)
  })

  it("Bug COMPTA #2 : revenus N-1 = 0, dépenses N-1 = 0, N > 0 → nouveau (vraiment rien en N-1)", () => {
    const r = computeYearDiff({
      revenus: 1200,
      revenusAnneePrecedente: 0,
      depensesAnneePrecedente: 0,
    })
    expect(r.state).toBe("nouveau")
  })

  it("Bug COMPTA #2 : revenus N et N-1 = 0 mais dépenses N-1 > 0 → nouveau-revenus (activité N-1 réelle)", () => {
    const r = computeYearDiff({
      revenus: 0,
      revenusAnneePrecedente: 0,
      depensesAnneePrecedente: 3300,
    })
    expect(r.state).toBe("nouveau-revenus")
    expect(r.depensesPrecedente).toBe(3300)
  })

  it("stats null → state=vide (et pas de crash)", () => {
    expect(computeYearDiff(null).state).toBe("vide")
    expect(computeYearDiff(undefined).state).toBe("vide")
  })

  it("Bug #6 régression : N-1 = 50 € (sous l'ancien seuil 100€) → compare quand même", () => {
    // L'ancien code (`previous >= 100`) cachait les comparatifs entre
    // 1 € et 99 €. Désormais on compare dès que N-1 > 0.
    const r = computeYearDiff({ revenus: 75, revenusAnneePrecedente: 50 })
    expect(r.state).toBe("compare")
    expect(r.percent).toBe(50)
  })

  it("champs manquants traités comme 0", () => {
    const r = computeYearDiff({ revenus: 100 })
    expect(r.state).toBe("nouveau")
    expect(r.diff).toBe(100)
  })
})
