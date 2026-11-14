import { describe, expect, it } from "vitest"
import { dateJourSeul, estMinuitUtc, jourCivilStocke } from "./jour-civil"

// Les instants locaux suivent le fuseau réel du processus, fixé au lancement.

describe("jourCivilStocke", () => {
  it("minuit UTC pile : le jour saisi", () => {
    expect(jourCivilStocke(new Date("2027-06-01T00:00:00.000Z"))).toBe("2027-06-01")
    expect(jourCivilStocke("2027-06-01T00:00:00.000Z")).toBe("2027-06-01")
  })

  it("minuit local : le jour local en été et en hiver (cmvnulry1)", () => {
    // Deux saisons : le décalage dépend du fuseau réel du processus.
    expect(jourCivilStocke(new Date(2027, 3, 12))).toBe("2027-04-12")
    expect(jourCivilStocke(new Date(2027, 0, 4))).toBe("2027-01-04")
  })

  it("instant d'une étape faite après minuit local : le jour local", () => {
    expect(jourCivilStocke(new Date(2026, 8, 24, 0, 30))).toBe("2026-09-24")
    expect(jourCivilStocke(new Date(2026, 8, 24, 17))).toBe("2026-09-24")
  })

  it("jour seul inchangé ; absent ou illisible : null", () => {
    expect(jourCivilStocke("2027-04-12")).toBe("2027-04-12")
    expect(jourCivilStocke(null)).toBeNull()
    expect(jourCivilStocke(undefined)).toBeNull()
    expect(jourCivilStocke("")).toBeNull()
    expect(jourCivilStocke("pas une date")).toBeNull()
    // Un jour inexistant n'est pas un jour (`new Date` le ferait glisser au 3 mars).
    expect(jourCivilStocke("2027-02-31")).toBeNull()
    expect(jourCivilStocke("2027-13-01")).toBeNull()
  })
})

describe("dateJourSeul", () => {
  it("minuit local → minuit UTC du même jour civil", () => {
    expect(dateJourSeul(new Date(2027, 3, 12)).toISOString()).toBe("2027-04-12T00:00:00.000Z")
    expect(dateJourSeul(new Date(2027, 0, 4)).toISOString()).toBe("2027-01-04T00:00:00.000Z")
    expect(dateJourSeul(null)).toBeNull()
  })

  it("instant reçu (minuit local) → minuit UTC de son jour", () => {
    expect(dateJourSeul(new Date(2027, 3, 12)).toISOString()).toBe("2027-04-12T00:00:00.000Z")
  })

  it("idempotent : un minuit UTC déjà écrit ne recule pas dans le fuseau du processus", () => {
    const ecrite = new Date("2027-04-12T00:00:00.000Z")
    expect(dateJourSeul(ecrite).toISOString()).toBe("2027-04-12T00:00:00.000Z")
    expect(dateJourSeul(dateJourSeul(new Date(2027, 3, 12))).toISOString()).toBe("2027-04-12T00:00:00.000Z")
  })

  it("date illisible : date invalide", () => {
    expect(Number.isNaN(dateJourSeul(new Date(Number.NaN)).getTime())).toBe(true)
  })

  it("aller-retour : ce qu'on écrit se relit au même jour", () => {
    const ecrite = dateJourSeul(new Date(2027, 3, 12))
    expect(estMinuitUtc(ecrite)).toBe(true)
    expect(jourCivilStocke(ecrite)).toBe("2027-04-12")
  })
})
