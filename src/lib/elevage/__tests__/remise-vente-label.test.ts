import { describe, expect, it } from "vitest"

import { formatRemisesEnVente } from "../remise-vente-label"

describe("formatRemisesEnVente", () => {
  it("n'affiche rien quand aucun délai n'est actif", () => {
    expect(formatRemisesEnVente({})).toBe("")
    expect(formatRemisesEnVente({ lait: null, oeufs: null, viande: null })).toBe("")
  })

  it("affiche un seul volet sans séparateur", () => {
    expect(formatRemisesEnVente({ oeufs: "2026-08-04T00:00:00.000Z" })).toBe("Œufs 04/08/2026")
  })

  it("sépare les volets présents, sans séparateur orphelin", () => {
    const libelle = formatRemisesEnVente({
      oeufs: "2026-08-04T00:00:00.000Z",
      viande: "2026-08-15T00:00:00.000Z",
    })

    expect(libelle).toBe("Œufs 04/08/2026 · Viande 15/08/2026")
    expect(libelle.startsWith("·")).toBe(false)
    expect(libelle.endsWith("·")).toBe(false)
  })

  it("garde l'ordre lait, œufs, viande quand les trois sont actifs", () => {
    expect(
      formatRemisesEnVente({
        viande: "2026-08-15T00:00:00.000Z",
        lait: "2026-08-02T00:00:00.000Z",
        oeufs: "2026-08-04T00:00:00.000Z",
      })
    ).toBe("Lait 02/08/2026 · Œufs 04/08/2026 · Viande 15/08/2026")
  })

  it("accepte des objets Date comme des chaînes ISO", () => {
    expect(formatRemisesEnVente({ lait: new Date("2026-08-02T00:00:00.000Z") })).toBe("Lait 02/08/2026")
  })
})
