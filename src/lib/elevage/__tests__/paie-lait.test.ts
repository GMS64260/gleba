import { describe, it, expect } from "vitest"
import { montantPaie, estimePrimeQualite, GRILLE_DEFAUT } from "../paie-lait"

describe("montantPaie", () => {
  it("calcule base + prime − pénalité", () => {
    // 5000 L × 700 €/1000 = 3500 ; +120 prime −40 pénalité = 3580
    expect(montantPaie(5000, 700, 120, 40)).toBe(3580)
  })
  it("sans prime ni pénalité", () => {
    expect(montantPaie(2000, 750)).toBe(1500)
  })
})

describe("estimePrimeQualite", () => {
  it("prime positive quand TB/TP au-dessus de la référence", () => {
    const r = estimePrimeQualite({ tb: 40, tp: 32 }, 1000, GRILLE_DEFAUT)
    // TB +2 g ×2 = 4 ; TP +2 g ×4 = 8 → 12 €/1000L × 1 = 12
    expect(r.prime).toBe(12)
    expect(r.penalite).toBe(0)
  })
  it("pénalité si cellules et germes au-dessus des seuils", () => {
    const r = estimePrimeQualite({ cellules: 2000, germes: 800 }, 2000, GRILLE_DEFAUT)
    // malus (20 + 15) €/1000L × 2 = 70
    expect(r.penalite).toBe(70)
  })
  it("prime négative si taux sous la référence", () => {
    const r = estimePrimeQualite({ tb: 36, tp: 30 }, 1000, GRILLE_DEFAUT)
    // TB -2 ×2 = -4 ; TP 0 → -4
    expect(r.prime).toBe(-4)
  })
})
