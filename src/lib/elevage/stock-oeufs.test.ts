import { describe, expect, it } from "vitest"
import { datesLotOeufs, refusModificationCollecteEntamee, statutLotOeufs, stockRestantLotOeufs } from "./stock-oeufs"

describe("stock d'œufs", () => {
  it("calcule la limite de vente à J+21 et la DCR à J+28", () => {
    const dates = datesLotOeufs(new Date("2026-07-01T00:00:00Z"))
    expect(dates.limiteVente.toISOString().slice(0, 10)).toBe("2026-07-22")
    expect(dates.dcr.toISOString().slice(0, 10)).toBe("2026-07-29")
  })

  it("distingue commercialisable, à consommer et périmé", () => {
    const ponte = new Date("2026-07-01T00:00:00Z")
    expect(statutLotOeufs(ponte, new Date("2026-07-20T00:00:00Z"))).toBe("commercialisable")
    expect(statutLotOeufs(ponte, new Date("2026-07-25T00:00:00Z"))).toBe("a_consumer")
    expect(statutLotOeufs(ponte, new Date("2026-07-30T00:00:00Z"))).toBe("perime")
  })

  it("soustrait casses, sales et sorties typées sans stock négatif", () => {
    expect(stockRestantLotOeufs({
      quantite: 30,
      casses: 2,
      sales: 1,
      sorties: [{ quantite: 10 }, { quantite: 3 }],
    })).toBe(14)
    expect(stockRestantLotOeufs({ quantite: 3, sorties: [{ quantite: 9 }] })).toBe(0)
  })
})

describe("refusModificationCollecteEntamee", () => {
  const collecte = { quantite: 300, casses: 0, sales: 0, date: new Date("2026-11-05T00:00:00Z"), lotId: 71, animalId: null }
  const sorties = [{ quantite: 24, date: new Date("2026-11-06T10:00:00Z") }]

  it("laisse tout corriger tant qu'aucun œuf n'est sorti", () => {
    expect(refusModificationCollecteEntamee(collecte, { ...collecte, quantite: 1, lotId: 3 }, [])).toBeNull()
  })

  it("admet la faute de frappe corrigée (300 → 30) et les champs sans effet sur le stock", () => {
    expect(refusModificationCollecteEntamee(collecte, { ...collecte, quantite: 30 }, sorties)).toBeNull()
    expect(refusModificationCollecteEntamee(collecte, { ...collecte }, sorties)).toBeNull()
    expect(refusModificationCollecteEntamee(collecte, { ...collecte, date: new Date("2026-11-04T00:00:00Z") }, sorties)).toBeNull()
  })

  it("refuse une quantité nette sous le total sorti, un jour après la première sortie, un autre lot", () => {
    expect(refusModificationCollecteEntamee(collecte, { ...collecte, quantite: 20 }, sorties)).toContain("24 œufs")
    expect(refusModificationCollecteEntamee(collecte, { ...collecte, quantite: 30, casses: 10 }, sorties)).toContain("sous 24")
    expect(refusModificationCollecteEntamee(collecte, { ...collecte, date: new Date("2026-11-07T00:00:00Z") }, sorties)).toContain("première sortie")
    expect(refusModificationCollecteEntamee(collecte, { ...collecte, lotId: 72 }, sorties)).toContain("lot")
  })
})
