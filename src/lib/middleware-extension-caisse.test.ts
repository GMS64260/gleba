import { describe, expect, it } from "vitest"
import * as module from "./middleware-extension-caisse"
import * as publicNeutre from "./middleware-extension-caisse.public"

describe("extension publique du middleware", () => {
  it("expose le contrat du stub public", () => {
    expect(Object.keys(module)).toEqual(Object.keys(publicNeutre))
  })

  it.each(["/", "/login", "/api/health", "/uploads/photo.jpg"])("n'ajoute aucune exception pour %s", (chemin) => {
    for (const methode of ["GET", "POST", "PUT"]) {
      expect(module.estExceptionMiddleware(chemin, methode)).toBe(false)
    }
  })
})
