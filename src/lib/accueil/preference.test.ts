import { describe, expect, it } from "vitest"

import { CHEMIN_ACCUEIL, sanitizeVersionAccueil, versionAccueilEffective } from "./preference"

describe("sanitizeVersionAccueil", () => {
  it("accepte v1 et v2, retombe sur v1 sinon", () => {
    expect(sanitizeVersionAccueil("v2")).toBe("v2")
    expect(sanitizeVersionAccueil("v1")).toBe("v1")
    expect(sanitizeVersionAccueil("v3")).toBe("v1")
    expect(sanitizeVersionAccueil(undefined)).toBe("v1")
    expect(sanitizeVersionAccueil({ v: 2 })).toBe("v1")
  })
})

describe("versionAccueilEffective", () => {
  it("un compte réel suit sa préférence", () => {
    expect(versionAccueilEffective({ preference: "v2", estDemo: false })).toBe("v2")
    expect(versionAccueilEffective({ preference: null, estDemo: false })).toBe("v1")
  })

  it("la démo ignore sa préférence et suit l'environnement", () => {
    expect(versionAccueilEffective({ preference: "v2", estDemo: true })).toBe("v1")
    expect(versionAccueilEffective({ preference: "v1", estDemo: true, accueilDemoEnv: "v2" })).toBe("v2")
    expect(versionAccueilEffective({ preference: "v2", estDemo: true, accueilDemoEnv: "oui" })).toBe("v1")
  })

  it("chaque version a son chemin", () => {
    expect(CHEMIN_ACCUEIL.v1).toBe("/dashboard")
    expect(CHEMIN_ACCUEIL.v2).toBe("/aujourdhui")
  })
})
