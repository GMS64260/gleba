import { describe, expect, it } from "vitest"
import { datesLotOeufs, statutLotOeufs, stockRestantLotOeufs } from "./stock-oeufs"

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
