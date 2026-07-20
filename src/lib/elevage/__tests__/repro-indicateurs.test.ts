import { describe, it, expect } from "vitest"
import { indicateursRepro } from "../repro-indicateurs"

describe("indicateursRepro", () => {
  it("calcule fertilité, prolificité et mortinatalité", () => {
    const saillies = [
      { femelleId: 1, date: "2025-09-01", statut: "Mise-bas réalisée" },
      { femelleId: 2, date: "2025-09-02", statut: "Gestante" },
      { femelleId: 3, date: "2025-09-03", statut: "Non gestante" },
      { femelleId: 4, date: "2025-09-04", statut: "En attente" }, // sans issue → hors dénominateur
    ]
    const naissances = [
      { mereId: 1, date: "2026-02-01", nombreNes: 2, nombreVivants: 2 },
      { mereId: 2, date: "2026-02-05", nombreNes: 3, nombreVivants: 2 },
    ]
    const r = indicateursRepro(saillies, naissances, [])
    // 2 fécondantes / 3 avec issue = 66,7 %
    expect(r.tauxFertilite).toBe(66.7)
    expect(r.nbSailliesAvecIssue).toBe(3)
    // prolificité = (2+3)/2 = 2.5 ; vivants (2+2)/2 = 2
    expect(r.prolificite).toBe(2.5)
    expect(r.prolificiteVivants).toBe(2)
    // mortinatalité = (5-4)/5 = 20 %
    expect(r.mortaliteNaissance).toBe(20)
  })

  it("calcule l'IVV sur les femelles à ≥ 2 mises-bas", () => {
    const naissances = [
      { mereId: 1, date: "2025-01-01", nombreNes: 2, nombreVivants: 2 },
      { mereId: 1, date: "2026-01-01", nombreNes: 2, nombreVivants: 2 }, // +365 j
      { mereId: 2, date: "2025-06-01", nombreNes: 1, nombreVivants: 1 }, // une seule → exclue de l'IVV
    ]
    const r = indicateursRepro([], naissances, [])
    expect(r.nbFemellesIvv).toBe(1)
    expect(r.ivvMoyenJours).toBe(365)
  })

  it("calcule l'âge au premier part", () => {
    const naissances = [{ mereId: 1, date: "2026-01-01", nombreNes: 2, nombreVivants: 2 }]
    const femelles = [{ id: 1, dateNaissance: "2024-01-01" }] // ~730 j
    const r = indicateursRepro([], naissances, femelles)
    expect(r.nbFemellesAgePremierPart).toBe(1)
    expect(r.agePremierPartJours).toBe(731) // 2 ans dont un bissextile (2024)
  })

  it("renvoie null quand il n'y a pas de données", () => {
    const r = indicateursRepro([], [], [])
    expect(r.tauxFertilite).toBeNull()
    expect(r.prolificite).toBeNull()
    expect(r.ivvMoyenJours).toBeNull()
    expect(r.agePremierPartJours).toBeNull()
  })
})
