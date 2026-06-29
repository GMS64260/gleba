import { describe, it, expect } from "vitest"
import {
  getTerritoire,
  factureSansTaxe,
  mentionFiscale,
  identifiantLegalAffichage,
} from "../territoires"

describe("territoires", () => {
  it("repli sur la métropole pour un code inconnu ou absent", () => {
    expect(getTerritoire(undefined).code).toBe("METROPOLE")
    expect(getTerritoire(null).code).toBe("METROPOLE")
    expect(getTerritoire("INEXISTANT").code).toBe("METROPOLE")
  })

  it("Nouvelle-Calédonie : RIDET, XPF, TGC, hors FEC", () => {
    const nc = getTerritoire("NOUVELLE_CALEDONIE")
    expect(nc.typeIdentifiant).toBe("RIDET")
    expect(nc.devise).toBe("XPF")
    expect(nc.libelleTaxe).toBe("TGC")
    expect(nc.fecApplicable).toBe(false)
  })

  it("métropole : SIRET, EUR, TVA, FEC applicable", () => {
    const m = getTerritoire("METROPOLE")
    expect(m.typeIdentifiant).toBe("SIRET")
    expect(m.devise).toBe("EUR")
    expect(m.fecApplicable).toBe(true)
  })

  it("factureSansTaxe : franchise + non-assujetti", () => {
    expect(factureSansTaxe("franchise-293b")).toBe(true)
    expect(factureSansTaxe("non-assujetti")).toBe(true)
    expect(factureSansTaxe("reel-normal")).toBe(false)
    expect(factureSansTaxe("tgc")).toBe(false)
    expect(factureSansTaxe(null)).toBe(false)
  })

  it("mentionFiscale selon le régime", () => {
    expect(mentionFiscale("franchise-293b")).toMatch(/293 B/)
    expect(mentionFiscale("non-assujetti")).toBe("TVA non applicable")
    expect(mentionFiscale("reel-normal")).toBeNull()
  })

  it("identifiantLegalAffichage : SIRET en métropole, RIDET en NC", () => {
    expect(
      identifiantLegalAffichage({ territoire: "METROPOLE", siret: "73282932000074" })
    ).toEqual({ label: "SIRET", valeur: "732 829 320 00074" })

    expect(
      identifiantLegalAffichage({ territoire: "NOUVELLE_CALEDONIE", identifiantLegal: "0858878004" })
    ).toEqual({ label: "RIDET", valeur: "0858878.004" })
  })

  it("identifiantLegalAffichage : null si aucun identifiant", () => {
    expect(identifiantLegalAffichage({ territoire: "METROPOLE", siret: null })).toBeNull()
    expect(
      identifiantLegalAffichage({ territoire: "NOUVELLE_CALEDONIE", identifiantLegal: null })
    ).toBeNull()
  })
})
