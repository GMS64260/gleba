import { describe, it, expect } from "vitest"
import { besoinsChevre, bilanRation } from "../ration"

describe("besoinsChevre", () => {
  it("calcule les besoins d'une chèvre de 60 kg à 3 L de lait", () => {
    const b = besoinsChevre({ poidsVif: 60, litresLait: 3, tauxButyreux: 35 })
    // PV^0.75 ≈ 21.56 → entretien ufl ≈ 0.71, pdi ≈ 54
    expect(b.detail.entretien.ufl).toBeCloseTo(0.71, 1)
    // lait : 0.44×3 = 1.32 UFL ; 48×3 = 144 g PDI
    expect(b.detail.lait.ufl).toBeCloseTo(1.32, 2)
    expect(b.detail.lait.pdi).toBe(144)
    // total ≈ 0.71 + 1.32 = 2.03 UFL
    expect(b.ufl).toBeCloseTo(2.03, 1)
    expect(b.pdi).toBe(198) // 54 + 144
  })

  it("corrige l'énergie du lait selon le taux butyreux", () => {
    const bas = besoinsChevre({ poidsVif: 60, litresLait: 3, tauxButyreux: 35 })
    const haut = besoinsChevre({ poidsVif: 60, litresLait: 3, tauxButyreux: 45 })
    expect(haut.detail.lait.ufl).toBeGreaterThan(bas.detail.lait.ufl)
  })

  it("ajoute le surcoût de gestation finale", () => {
    const sans = besoinsChevre({ poidsVif: 60, litresLait: 0 })
    const avec = besoinsChevre({ poidsVif: 60, litresLait: 0, stadeGestation: "gestation_finale" })
    expect(avec.ufl - sans.ufl).toBeCloseTo(0.4, 2)
    expect(avec.pdi - sans.pdi).toBe(55)
  })
})

describe("bilanRation", () => {
  const besoins = besoinsChevre({ poidsVif: 60, litresLait: 3, tauxButyreux: 35 })

  it("somme les apports, applique PDI = min(PDIN, PDIE) et calcule la couverture", () => {
    const bilan = bilanRation(
      [
        { ufl: 0.62, pdin: 52, pdie: 84, uel: 1.05, prix: 0.18, quantiteKg: 2 }, // foin
        { ufl: 1.05, pdin: 130, pdie: 110, uel: 0.45, prix: 0.42, quantiteKg: 1 }, // granulés
      ],
      besoins
    )
    // UFL = 0.62×2 + 1.05 = 2.29
    expect(bilan.ufl).toBeCloseTo(2.29, 2)
    // PDIN = 52×2 + 130 = 234 ; PDIE = 84×2 + 110 = 278 → PDI = 234
    expect(bilan.pdin).toBe(234)
    expect(bilan.pdie).toBe(278)
    expect(bilan.pdi).toBe(234)
    // limitant = PDIN (le plus bas)
    expect(bilan.equilibrePDIN_PDIE).toBe("PDIN")
    // coût = 0.18×2 + 0.42 = 0.78
    expect(bilan.cout).toBe(0.78)
    // couverture UFL = 2.29 / 2.03 ≈ 113 %
    expect(bilan.couvertureUFL).toBeGreaterThan(100)
  })

  it("gère une ration vide", () => {
    const bilan = bilanRation([], besoins)
    expect(bilan.ufl).toBe(0)
    expect(bilan.couvertureUFL).toBe(0)
  })
})
