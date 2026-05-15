import { describe, it, expect } from "vitest"
import { verifierPrixAliment, estPrixHorsNorme } from "../prix-aliment-seuils"

describe("verifierPrixAliment", () => {
  it("Bug #12 régression : 22 €/kg sur granulés → hors-norme", () => {
    const r = verifierPrixAliment(22, "granules")
    expect(r.ok).toBe(false)
    expect(r.seuil).toBe(2.0)
    expect(r.message).toContain("22.00")
    expect(r.message).toContain("≤ 2.00")
  })

  it("0,50 €/kg granulés → ok", () => {
    expect(verifierPrixAliment(0.5, "granules").ok).toBe(true)
  })

  it("0,40 €/kg foin → ok", () => {
    expect(verifierPrixAliment(0.4, "foin").ok).toBe(true)
  })

  it("3 €/kg complément minéral → ok (catégorie tolère 5)", () => {
    expect(verifierPrixAliment(3, "complement").ok).toBe(true)
  })

  it("8 €/kg complément → hors-norme", () => {
    const r = verifierPrixAliment(8, "complement")
    expect(r.ok).toBe(false)
    expect(r.seuil).toBe(5.0)
  })

  it("catégorie 'autre' → pas de vérif (ok inconditionnel)", () => {
    expect(verifierPrixAliment(50, "autre").ok).toBe(true)
  })

  it("catégorie null (legacy) → pas de vérif", () => {
    expect(verifierPrixAliment(50, null).ok).toBe(true)
  })

  it("prix 0 ou négatif → toujours bloquant, sans seuil", () => {
    expect(verifierPrixAliment(0, "granules").ok).toBe(false)
    expect(verifierPrixAliment(-1, "granules").ok).toBe(false)
    expect(verifierPrixAliment(null, "granules").ok).toBe(false)
  })
})

describe("estPrixHorsNorme (helper migration)", () => {
  it("vrai pour 22€/kg granulés", () => {
    expect(estPrixHorsNorme(22, "granules")).toBe(true)
  })
  it("faux pour 0,5€/kg granulés", () => {
    expect(estPrixHorsNorme(0.5, "granules")).toBe(false)
  })
  it("faux quand catégorie inconnue (pas d'écrasement silencieux)", () => {
    expect(estPrixHorsNorme(50, null)).toBe(false)
  })
  it("faux quand prix manquant", () => {
    expect(estPrixHorsNorme(null, "granules")).toBe(false)
  })
})
