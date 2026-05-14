import { describe, it, expect } from "vitest"
import { getEspeceAliases, isEspeceEquivalent } from "../aliases"

describe("getEspeceAliases", () => {
  it("retourne le nom générique + toutes ses variantes", () => {
    const aliases = getEspeceAliases("Pois")
    expect(aliases).toContain("Pois")
    expect(aliases).toContain("Petit pois")
    expect(aliases).toContain("Pois gourmand")
  })

  it("résout une variante vers le générique + cousines", () => {
    const aliases = getEspeceAliases("Petit pois")
    expect(aliases).toContain("Petit pois")
    expect(aliases).toContain("Pois")
    expect(aliases).toContain("Pois gourmand")
    // pas de doublon
    expect(aliases.filter((a) => a === "Petit pois")).toHaveLength(1)
  })

  it("résout Chou (Brassica oleracea) — large famille de variantes", () => {
    const aliases = getEspeceAliases("Chou pommé")
    expect(aliases).toContain("Chou")
    expect(aliases).toContain("Chou pommé")
    expect(aliases).toContain("Chou-fleur")
    expect(aliases).toContain("Chou brocoli")
    expect(aliases).toContain("Chou kale")
  })

  it("résout Haricot vers ses 4 variantes", () => {
    const aliases = getEspeceAliases("Haricot vert")
    expect(aliases).toEqual(
      expect.arrayContaining([
        "Haricot vert",
        "Haricot",
        "Haricot sec",
        "Haricot beurre",
        "Haricot mangetout",
      ])
    )
  })

  it("retourne juste [id] pour une espèce sans synonyme connu", () => {
    expect(getEspeceAliases("Carotte")).toEqual(["Carotte"])
    expect(getEspeceAliases("Tomate")).toEqual(["Tomate"])
  })
})

describe("isEspeceEquivalent", () => {
  it("strict equal", () => {
    expect(isEspeceEquivalent("Tomate", "Tomate")).toBe(true)
  })
  it("variante ↔ générique", () => {
    expect(isEspeceEquivalent("Pois", "Petit pois")).toBe(true)
    expect(isEspeceEquivalent("Petit pois", "Pois")).toBe(true)
  })
  it("variantes du même groupe", () => {
    expect(isEspeceEquivalent("Chou-fleur", "Chou brocoli")).toBe(true)
  })
  it("pas équivalent quand sans rapport", () => {
    expect(isEspeceEquivalent("Tomate", "Pois")).toBe(false)
    expect(isEspeceEquivalent("Carotte", "Radis")).toBe(false)
  })
})
