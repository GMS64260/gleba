import { describe, expect, it } from "vitest"

import {
  dureeEntreSemaines,
  libellePeriodeSemaines,
  libellePeriodeSemainesCourt,
  libelleSemaine,
  periodesSeChevauchent,
  semaineFin,
} from "./semaines-lisibles"

describe("semaines lisibles", () => {
  it("lit une semaine ISO par le tiers de mois de son jeudi (2026)", () => {
    expect(libelleSemaine(1, 2026)).toBe("début janvier") // lundi 29/12/2025, jeudi 01/01
    expect(libelleSemaine(27, 2026)).toBe("début juillet") // jeudi 02/07
    expect(libelleSemaine(33, 2026)).toBe("mi-août") // jeudi 13/08
    expect(libelleSemaine(48, 2026)).toBe("fin novembre") // jeudi 26/11
    expect(libelleSemaine(52, 2026)).toBe("fin décembre")
  })

  it("calcule la fin et la durée en passant par janvier", () => {
    expect(semaineFin(27, 7)).toBe(33)
    expect(semaineFin(48, 10)).toBe(5)
    expect(dureeEntreSemaines(27, 33)).toBe(7)
    expect(dureeEntreSemaines(48, 5)).toBe(10)
    expect(dureeEntreSemaines(10, 10)).toBe(1)
  })

  it("libelle une période complète ou une semaine seule", () => {
    expect(libellePeriodeSemaines(27, 7, 2026)).toBe("de début juillet à mi-août (S27 → S33)")
    expect(libellePeriodeSemaines(27, null, 2026)).toBe("début juillet (S27)")
    expect(libellePeriodeSemaines(null, 4, 2026)).toBeNull()
    expect(libellePeriodeSemainesCourt(48, 10, 2026)).toBe("fin novembre → fin janvier") // S05 : jeudi 29/01
  })

  it("détecte le chevauchement de deux floraisons, y compris autour du nouvel an", () => {
    expect(periodesSeChevauchent({ debut: 27, duree: 7 }, { debut: 33, duree: 2 })).toBe(true)
    expect(periodesSeChevauchent({ debut: 27, duree: 4 }, { debut: 33, duree: 2 })).toBe(false)
    expect(periodesSeChevauchent({ debut: 50, duree: 6 }, { debut: 2, duree: 1 })).toBe(true)
    expect(periodesSeChevauchent({ debut: 14, duree: 2 }, { debut: 16, duree: 2 })).toBe(false)
  })
})
