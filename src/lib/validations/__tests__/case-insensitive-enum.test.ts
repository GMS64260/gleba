/**
 * DEV1 Ticket 1 — Tests du helper Zod `caseInsensitiveEnum`.
 * Audit Marc 2026-05-14 : POST /api/comptabilite/clients refusait
 * `type: "Particulier"` car le schema attendait `"particulier"`.
 */

import { describe, it, expect } from "vitest"
import { z } from "zod"
import { caseInsensitiveEnum } from "../case-insensitive-enum"

describe("caseInsensitiveEnum", () => {
  const TYPES = ["particulier", "professionnel", "association", "amap"] as const
  const schema = caseInsensitiveEnum(TYPES)

  it("accepte la valeur canonique lowercase", () => {
    const result = schema.parse("particulier")
    expect(result).toBe("particulier")
  })

  it("accepte la même valeur capitalisée et normalise vers lowercase canonique", () => {
    const result = schema.parse("Particulier")
    expect(result).toBe("particulier")
  })

  it("accepte la même valeur en MAJUSCULES", () => {
    expect(schema.parse("PROFESSIONNEL")).toBe("professionnel")
  })

  it("accepte la casse mixte arbitraire", () => {
    expect(schema.parse("aMaP")).toBe("amap")
    expect(schema.parse("aSSocIaTion")).toBe("association")
  })

  it("rejette une valeur non listée même en lowercase", () => {
    expect(() => schema.parse("autre")).toThrowError()
  })

  it("rejette une valeur non listée même en majuscules", () => {
    expect(() => schema.parse("Toto")).toThrowError()
  })

  it("préserve la casse canonique déclarée (test Vente capitalisé)", () => {
    // motifSortie en élevage utilise des valeurs capitalisées en BDD.
    const motifs = ["Vente", "Mort", "Abattage", "Réforme", "Don"] as const
    const sch = caseInsensitiveEnum(motifs)
    expect(sch.parse("vente")).toBe("Vente")
    expect(sch.parse("MORT")).toBe("Mort")
    expect(sch.parse("réforme")).toBe("Réforme")
  })

  it("se compose proprement avec .optional() et .default()", () => {
    const composed = schema.optional().default("particulier")
    expect(composed.parse(undefined)).toBe("particulier")
    expect(composed.parse("AMAP")).toBe("amap")
  })

  it("retourne un message d'erreur explicite", () => {
    try {
      schema.parse("invalide")
      throw new Error("Should have thrown")
    } catch (err) {
      if (err instanceof z.ZodError) {
        expect(err.issues[0].message).toContain("particulier")
        expect(err.issues[0].message).toContain("insensible à la casse")
      } else {
        throw err
      }
    }
  })

  it("lève si la liste est vide", () => {
    expect(() => caseInsensitiveEnum([])).toThrowError()
  })
})
