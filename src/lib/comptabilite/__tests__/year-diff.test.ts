import { describe, it, expect } from "vitest"
import { computeYearDiff, libelleComparatifRevenus } from "../year-diff"

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

describe("libelleComparatifRevenus", () => {
  const euro = (n: number) => `${n.toFixed(2)} €`

  it("ticket cmv290vir : exercice 2024 sans revenus ni activité en 2023 → le libellé porte sur 2023", () => {
    const diff = computeYearDiff({ revenus: 0, depenses: 1400, revenusAnneePrecedente: 0, depensesAnneePrecedente: 0 })
    const texte = libelleComparatifRevenus(diff, 2024, euro)
    expect(texte).toBe("Pas de revenus en 2024 · aucune activité en 2023")
    // Ne répète plus les dépenses de l'exercice affiché.
    expect(texte).not.toContain("1400")
  })

  it("chaque état nomme l'année précédente", () => {
    const cas = [
      { revenus: 1500, revenusAnneePrecedente: 1000 },
      { revenus: 1200, revenusAnneePrecedente: 0 },
      { revenus: 0, revenusAnneePrecedente: 0, depensesAnneePrecedente: 300 },
      { revenus: 0, depenses: 50, revenusAnneePrecedente: 0 },
      { revenus: 0, revenusAnneePrecedente: 0 },
    ]
    for (const stats of cas) {
      expect(libelleComparatifRevenus(computeYearDiff(stats), 2024, euro)).toContain("2023")
    }
  })

  it("nouveau-revenus cite les dépenses de N-1", () => {
    const diff = computeYearDiff({ revenus: 0, revenusAnneePrecedente: 0, depensesAnneePrecedente: 300 })
    expect(libelleComparatifRevenus(diff, 2025, euro)).toBe("2024 : 0 € de revenus, 300.00 € de dépenses")
  })
})
