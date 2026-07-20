import { describe, it, expect } from "vitest"
import { etatPhysiologique } from "../etat-physiologique"

const ref = new Date("2026-07-20")

describe("etatPhysiologique", () => {
  it("nullipare si jamais mis bas", () => {
    expect(etatPhysiologique({ aMisBas: false, gestante: false, derniereCollecte: null }, ref)).toBe("nullipare")
  })
  it("en lactation si collecte récente et non gestante", () => {
    expect(etatPhysiologique({ aMisBas: true, gestante: false, derniereCollecte: "2026-07-18" }, ref)).toBe("lactation")
  })
  it("lactation + gestante si trait et gestante", () => {
    expect(etatPhysiologique({ aMisBas: true, gestante: true, derniereCollecte: "2026-07-19" }, ref)).toBe("lactation_gestante")
  })
  it("tarie gestante si gestante sans collecte récente", () => {
    expect(etatPhysiologique({ aMisBas: true, gestante: true, derniereCollecte: "2026-05-01" }, ref)).toBe("gestante_tarie")
  })
  it("vide si a mis bas mais ni gestante ni traite", () => {
    expect(etatPhysiologique({ aMisBas: true, gestante: false, derniereCollecte: "2026-01-01" }, ref)).toBe("vide")
    expect(etatPhysiologique({ aMisBas: true, gestante: false, derniereCollecte: null }, ref)).toBe("vide")
  })
})
