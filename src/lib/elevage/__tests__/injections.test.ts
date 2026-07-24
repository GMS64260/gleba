import { describe, expect, it } from "vitest"
import { calendrierInjections, derniereInjectionActive } from "../injections"

describe("calendrierInjections", () => {
  it("génère trois administrations et ne réalise que la première", () => {
    const debut = new Date("2026-03-11T08:00:00.000Z")
    const injections = calendrierInjections(debut, 3, 24, true)
    expect(injections.map((i) => i.statut)).toEqual(["realisee", "a_faire", "a_faire"])
    expect(injections[2].datePrevue.toISOString()).toBe("2026-03-13T08:00:00.000Z")
  })

  it("exclut une injection annulée du calcul de la dernière administration", () => {
    const injections = calendrierInjections(new Date("2026-03-11T08:00:00.000Z"), 3, 24, true)
    injections[2].statut = "annulee"
    expect(derniereInjectionActive(injections)?.toISOString()).toBe("2026-03-12T08:00:00.000Z")
  })

  it("refuse un protocole multiple sans intervalle valide", () => {
    expect(() => calendrierInjections(new Date(), 3, null, false)).toThrow()
  })
})
