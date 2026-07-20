import { describe, it, expect } from "vitest"
import { indicateursEconomieLait } from "../economie-lait"

describe("indicateursEconomieLait", () => {
  it("calcule MCA, coût/litre et marge sur un cas simple", () => {
    const r = indicateursEconomieLait({
      litresProduits: 10000,
      litresTransformes: 8000,
      litresVendusCru: 2000,
      litresEcartes: 0,
      caLaitCru: 2000, // 2000 L × 1 €/L
      caFromage: 16000,
      coutAlimentaire: 6000,
      coutSanitaire: 1000,
      kgFromage: 1000, // 8000 L → 1000 kg = 8 L/kg
    })
    expect(r.valorisation).toBe(18000)
    expect(r.coutTotal).toBe(7000)
    expect(r.marge).toBe(11000)
    // MCA = 18000 − 6000 = 12000
    expect(r.mca).toBe(12000)
    // MCA / 1000 L = 12000 / 10 = 1200
    expect(r.mcaPour1000L).toBe(1200)
    expect(r.coutAlimentaireLitre).toBe(0.6)
    expect(r.coutRevientLitre).toBe(0.7)
    expect(r.prixMoyenLitreValorise).toBe(1.8)
    // rendement 1000 kg / 8000 L = 0.125 kg/L
    expect(r.rendementFromager).toBe(0.125)
    expect(r.litresParKgFromage).toBe(8)
    // coût kg fromage : coutTotal 7000 × part transfo (8000/10000=0.8) / 1000 kg = 5.6
    expect(r.coutRevientKgFromage).toBe(5.6)
  })

  it("renvoie null sur les ratios quand il n'y a pas de production", () => {
    const r = indicateursEconomieLait({
      litresProduits: 0,
      litresTransformes: 0,
      litresVendusCru: 0,
      litresEcartes: 0,
      caLaitCru: 0,
      caFromage: 0,
      coutAlimentaire: 0,
      coutSanitaire: 0,
      kgFromage: 0,
    })
    expect(r.coutAlimentaireLitre).toBeNull()
    expect(r.rendementFromager).toBeNull()
    expect(r.coutRevientKgFromage).toBeNull()
    expect(r.mcaPour1000L).toBeNull()
  })

  it("gère une MCA négative (coût alimentaire supérieur à la valorisation)", () => {
    const r = indicateursEconomieLait({
      litresProduits: 1000,
      litresTransformes: 0,
      litresVendusCru: 1000,
      litresEcartes: 0,
      caLaitCru: 500,
      caFromage: 0,
      coutAlimentaire: 800,
      coutSanitaire: 100,
      kgFromage: 0,
    })
    expect(r.mca).toBe(-300)
    expect(r.marge).toBe(-400)
  })
})
