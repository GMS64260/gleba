import { describe, expect, it } from "vitest"
import { FUSEAU_PAR_DEFAUT, FUSEAUX_PROPOSES, fuseauAffichable } from "./connecteurs"

describe("fuseauAffichable", () => {
  it("garde un fuseau IANA valide, de la liste ou non", () => {
    for (const fuseau of [...FUSEAUX_PROPOSES, "Asia/Tokyo"]) expect(fuseauAffichable(fuseau)).toBe(fuseau)
  })

  it("retombe sur le défaut pour un fuseau invalide ou absent, au lieu d'une RangeError", () => {
    expect(() => new Intl.DateTimeFormat("fr-FR", { timeZone: "Mars/Olympus" })).toThrow(RangeError)
    for (const fuseau of ["Mars/Olympus", "Europe/Paris'; --", "", null, undefined]) {
      expect(fuseauAffichable(fuseau)).toBe(FUSEAU_PAR_DEFAUT)
    }
  })
})
