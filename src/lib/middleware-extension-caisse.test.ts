import { describe, expect, expectTypeOf, it } from "vitest"
import * as prive from "./middleware-extension-caisse"
import * as publicNeutre from "./middleware-extension-caisse.public"

describe("contrat des extensions du middleware", () => {
  it("conserve les mêmes exports et types dans le stub public", () => {
    expect(Object.keys(prive)).toEqual(Object.keys(publicNeutre))
    expectTypeOf(prive).toEqualTypeOf<typeof publicNeutre>()
  })

  it.each([
    ["/caisse/manifest.webmanifest", [true, true, true]],
    ["/caisse/hors-ligne", [true, true, true]],
    ["/api/caisse/clotures/planifiee", [false, true, false]],
    ["/caisse", [false, false, false]],
    ["/caisse/hors-ligne/autre", [false, false, false]],
    ["/caisse/manifest.webmanifest/", [false, false, false]],
    ["/api/caisse/clotures/planifiee.png", [false, false, false]],
    ["/api/caisse/clotures/planifiee/autre", [false, false, false]],
    ["/api/caisse/clotures/planifiee/", [false, false, false]],
  ])("décide uniquement les exceptions existantes pour %s", (chemin, attendus) => {
    for (const [index, methode] of ["GET", "POST", "PUT"].entries()) {
      expect(prive.estExceptionMiddleware(chemin, methode)).toBe(attendus[index])
      expect(publicNeutre.estExceptionMiddleware(chemin, methode)).toBe(false)
    }
  })
})
