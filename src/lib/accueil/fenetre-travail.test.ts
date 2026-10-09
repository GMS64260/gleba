import { describe, expect, it } from "vitest"

import { calculerFenetreTravail, nommerJour, phraseFenetreTravail } from "./fenetre-travail"

// Jeudi 8 octobre 2026, 10 h locale.
const AUJOURDHUI = new Date(2026, 9, 8, 10)

const previsions = [
  { date: "2026-10-08", tempMin: 7, precipitation: 0 },
  { date: "2026-10-09", tempMin: 8, precipitation: 0.4 },
  { date: "2026-10-10", tempMin: 6, precipitation: 0 },
  { date: "2026-10-11", tempMin: 5, precipitation: 6.2 },
  { date: "2026-10-12", tempMin: 4, precipitation: 0 },
  { date: "2026-10-13", tempMin: -1, precipitation: 0 },
  { date: "2026-10-14", tempMin: 2, precipitation: 0 },
]

describe("calculerFenetreTravail", () => {
  it("compte les jours secs jusqu'à la première pluie et repère le gel", () => {
    const f = calculerFenetreTravail(previsions)
    expect(f.joursSecs).toBe(3)
    expect(f.dernierJourSec).toBe("2026-10-10")
    expect(f.prochainePluie).toEqual({ date: "2026-10-11", mm: 6.2 })
    expect(f.gel).toEqual({ date: "2026-10-13", tempMin: -1 })
  })

  it("pluie dès aujourd'hui : zéro jour sec", () => {
    const f = calculerFenetreTravail([{ date: "2026-10-08", tempMin: 9, precipitation: 3 }])
    expect(f.joursSecs).toBe(0)
    expect(f.dernierJourSec).toBeNull()
    expect(f.prochainePluie).toEqual({ date: "2026-10-08", mm: 3 })
  })

  it("sans prévision, rien n'est affirmé", () => {
    expect(calculerFenetreTravail([])).toEqual({ joursSecs: 0, dernierJourSec: null, prochainePluie: null, gel: null })
  })
})

describe("nommerJour", () => {
  it("aujourd'hui, demain, puis le nom du jour (ancré à midi local)", () => {
    expect(nommerJour("2026-10-08", AUJOURDHUI)).toBe("aujourd'hui")
    expect(nommerJour("2026-10-09", AUJOURDHUI)).toBe("demain")
    expect(nommerJour("2026-10-10", AUJOURDHUI)).toBe("samedi")
    expect(nommerJour("2026-10-13", AUJOURDHUI)).toBe("mardi")
  })
})

describe("phraseFenetreTravail", () => {
  it("« sec jusqu'à samedi · 6,2 mm dimanche · gel probable mardi »", () => {
    const phrase = phraseFenetreTravail(calculerFenetreTravail(previsions), AUJOURDHUI)
    expect(phrase.principal).toBe("sec jusqu'à samedi")
    expect(phrase.details).toEqual(["6.2 mm dimanche", "gel probable mardi (-1 °C)"])
  })

  it("sec toute la semaine quand aucune pluie n'est prévue", () => {
    const secs = previsions.map((p) => ({ ...p, precipitation: 0 }))
    expect(phraseFenetreTravail(calculerFenetreTravail(secs), AUJOURDHUI).principal).toBe("sec toute la semaine")
  })

  it("pluie aujourd'hui", () => {
    const phrase = phraseFenetreTravail(
      calculerFenetreTravail([{ date: "2026-10-08", tempMin: 9, precipitation: 3 }]),
      AUJOURDHUI,
    )
    expect(phrase.principal).toBe("pluie aujourd'hui · 3 mm")
    expect(phrase.details).toEqual([])
  })

  it("sans prévision : le dit, sans inventer", () => {
    expect(phraseFenetreTravail(calculerFenetreTravail([]), AUJOURDHUI).principal).toBe("prévisions indisponibles")
  })
})
