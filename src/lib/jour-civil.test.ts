import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { dateJourSeul, estMinuitUtc, jourCivilStocke } from "./jour-civil"

/** Le conteneur et le navigateur de la QA tournent en Europe/Paris. */
const tzAvant = process.env.TZ
beforeAll(() => {
  process.env.TZ = "Europe/Paris"
})
afterAll(() => {
  if (tzAvant === undefined) delete process.env.TZ
  else process.env.TZ = tzAvant
})

describe("jourCivilStocke", () => {
  it("minuit UTC pile : le jour saisi", () => {
    expect(jourCivilStocke(new Date("2027-06-01T00:00:00.000Z"))).toBe("2027-06-01")
    expect(jourCivilStocke("2027-06-01T00:00:00.000Z")).toBe("2027-06-01")
  })

  it("minuit LOCAL stocké la veille en UTC : le jour local (cmvnulry1)", () => {
    // Été (UTC+2) et hiver (UTC+1).
    expect(jourCivilStocke(new Date("2027-04-11T22:00:00.000Z"))).toBe("2027-04-12")
    expect(jourCivilStocke(new Date("2027-01-03T23:00:00.000Z"))).toBe("2027-01-04")
  })

  it("instant d'une étape faite après minuit à Paris : le jour local", () => {
    expect(jourCivilStocke(new Date("2026-09-23T22:30:00.000Z"))).toBe("2026-09-24")
    expect(jourCivilStocke(new Date("2026-09-24T15:00:00.000Z"))).toBe("2026-09-24")
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

  it("instant reçu (minuit à Paris) → minuit UTC de son jour", () => {
    expect(dateJourSeul(new Date("2027-04-11T22:00:00.000Z")).toISOString()).toBe("2027-04-12T00:00:00.000Z")
  })

  it("idempotent : un minuit UTC déjà écrit ne recule pas, même à l'ouest d'UTC", () => {
    for (const fuseau of ["Europe/Paris", "UTC", "Pacific/Tahiti", "America/Martinique", "Pacific/Noumea"]) {
      process.env.TZ = fuseau
      const ecrite = new Date("2027-04-12T00:00:00.000Z")
      expect(dateJourSeul(ecrite).toISOString(), fuseau).toBe("2027-04-12T00:00:00.000Z")
      expect(dateJourSeul(dateJourSeul(new Date(2027, 3, 12))).toISOString(), fuseau).toBe("2027-04-12T00:00:00.000Z")
    }
    process.env.TZ = "Europe/Paris"
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
