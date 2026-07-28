import { describe, it, expect } from "vitest"
import { capacites, estRente, normaliserSousOnglet } from "@/lib/elevage/filiere-ui"
import { coerceFiliere, isFiliere, FILIERES } from "@/lib/elevage/filiere"

describe("filiere — coercition", () => {
  it("reconnaît les filières valides", () => {
    expect(isFiliere("compagnie")).toBe(true)
    expect(isFiliere("rente")).toBe(true)
    expect(isFiliere("xxx")).toBe(false)
    expect(isFiliere(undefined)).toBe(false)
  })

  it("retombe sur 'rente' pour toute valeur inconnue/null", () => {
    expect(coerceFiliere("xxx")).toBe("rente")
    expect(coerceFiliere(undefined)).toBe("rente")
    expect(coerceFiliere(null)).toBe("rente")
    expect(coerceFiliere("equin")).toBe("equin")
  })
})

describe("filiere-ui — capacites", () => {
  it("'rente' conserve toutes les surfaces de rente", () => {
    const c = capacites("rente")
    expect(c.productionRente).toBe(true)
    expect(c.delaisAttente).toBe(true)
    expect(c.tarissement).toBe(true)
    expect(c.ponte).toBe(true)
    expect(c.abattage).toBe(true)
    expect(c.reservations).toBe(false)
    expect(c.selection).toBe(false)
    expect(c.dashboard).toBe("rente")
    expect(estRente("rente")).toBe(true)
  })

  it("compagnie/équin/NAC masquent les surfaces de rente mais gardent repro/généalogie", () => {
    for (const f of ["compagnie", "equin", "nac"] as const) {
      const c = capacites(f)
      expect(c.productionRente).toBe(false)
      expect(c.delaisAttente).toBe(false)
      expect(c.tarissement).toBe(false)
      expect(c.ponte).toBe(false)
      expect(c.abattage).toBe(false)
      expect(c.reproduction).toBe(true)
      expect(c.genealogie).toBe(true)
      expect(c.dashboard).toBe("compagnie")
      expect(estRente(f)).toBe(false)
    }
  })

  it("réserve les parcours de cession à compagnie et la sélection à compagnie/équin", () => {
    expect(capacites("compagnie")).toMatchObject({ reservations: true, selection: true })
    expect(capacites("equin")).toMatchObject({ reservations: false, selection: true })
    expect(capacites("nac")).toMatchObject({ reservations: false, selection: false })
  })

  it("toutes les filières déclarées ont des capacités", () => {
    for (const f of FILIERES) {
      expect(capacites(f)).toBeTruthy()
    }
  })

  it("replie un sous-onglet devenu indisponible après changement d'atelier", () => {
    expect(normaliserSousOnglet(
      "campagnes",
      ["saillies", "naissances", "selection"],
      "saillies",
    )).toBe("saillies")
    expect(normaliserSousOnglet(
      "selection",
      ["saillies", "naissances", "selection"],
      "saillies",
    )).toBe("selection")
  })
})
