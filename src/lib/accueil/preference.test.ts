import { describe, expect, it } from "vitest"

import { CHEMIN_ACCUEIL, VERSION_ACCUEIL_DEFAUT, sanitizeVersionAccueil, versionAccueilEffective } from "./preference"

describe("sanitizeVersionAccueil", () => {
  it("v2 est la version par défaut depuis la bascule L5-A", () => {
    expect(VERSION_ACCUEIL_DEFAUT).toBe("v2")
  })

  it("accepte v1 et v2, retombe sur v2 sinon", () => {
    expect(sanitizeVersionAccueil("v2")).toBe("v2")
    expect(sanitizeVersionAccueil("v1")).toBe("v1")
    expect(sanitizeVersionAccueil("v3")).toBe("v2")
    expect(sanitizeVersionAccueil(undefined)).toBe("v2")
    expect(sanitizeVersionAccueil({ v: 2 })).toBe("v2")
  })
})

describe("versionAccueilEffective", () => {
  it("un compte réel suit sa préférence, v2 sans préférence", () => {
    expect(versionAccueilEffective({ preference: "v2", estDemo: false })).toBe("v2")
    expect(versionAccueilEffective({ preference: "v1", estDemo: false })).toBe("v1")
    expect(versionAccueilEffective({ preference: null, estDemo: false })).toBe("v2")
  })

  it("la démo ignore sa préférence et suit l'environnement, v2 sans variable", () => {
    expect(versionAccueilEffective({ preference: "v1", estDemo: true })).toBe("v2")
    expect(versionAccueilEffective({ preference: "v2", estDemo: true, accueilDemoEnv: "v1" })).toBe("v1")
    expect(versionAccueilEffective({ preference: "v1", estDemo: true, accueilDemoEnv: "v2" })).toBe("v2")
    expect(versionAccueilEffective({ preference: "v1", estDemo: true, accueilDemoEnv: "oui" })).toBe("v2")
  })

  it("chaque version a son chemin", () => {
    expect(CHEMIN_ACCUEIL.v1).toBe("/dashboard")
    expect(CHEMIN_ACCUEIL.v2).toBe("/aujourdhui")
  })
})
