import { describe, expect, it } from "vitest"

import { echeanceDuJour, etatEcheance, hrefEcheance } from "./elevage"
import { recolteDominante } from "./reperes"

describe("recolteDominante", () => {
  it("retient la plus grosse unité et son écart N-1 à date égale", () => {
    expect(
      recolteDominante({
        recoltesParUniteYtd: { kg: 11666, tige: 40 },
        recoltesParUniteN1Ytd: { kg: 11332 },
      }),
    ).toEqual({ valeur: 11666, unite: "kg", valeurN1: 11332, ecartN1: 334 })
  })

  it("une ferme de fleurs coupées lit ses tiges, pas zéro kilo", () => {
    expect(
      recolteDominante({ recoltesParUniteYtd: { tige: 647 }, recoltesParUniteN1Ytd: { tige: 700 } }),
    ).toEqual({ valeur: 647, unite: "tige", valeurN1: 700, ecartN1: -53 })
  })

  it("sans récolte cette année : zéro dans l'unité de l'an passé", () => {
    expect(recolteDominante({ recoltesParUniteYtd: {}, recoltesParUniteN1Ytd: { kg: 120 } })).toEqual({
      valeur: 0,
      unite: "kg",
      valeurN1: 120,
      ecartN1: -120,
    })
    expect(recolteDominante({ recoltesParUniteYtd: {}, recoltesParUniteN1Ytd: {} })).toEqual({
      valeur: 0,
      unite: "kg",
      valeurN1: 0,
      ecartN1: 0,
    })
  })
})

describe("échéances d'élevage dans la liste du jour", () => {
  it("retient les urgentes et celles du jour ou en retard", () => {
    expect(echeanceDuJour({ gravite: "urgent", joursRestants: 5 })).toBe(true)
    expect(echeanceDuJour({ gravite: "info", joursRestants: 0 })).toBe(true)
    expect(echeanceDuJour({ gravite: "attention", joursRestants: -2 })).toBe(true)
    expect(echeanceDuJour({ gravite: "attention", joursRestants: 3 })).toBe(false)
    expect(echeanceDuJour({ gravite: "info", joursRestants: null })).toBe(false)
  })

  it("traduit la gravité en état de registre", () => {
    expect(etatEcheance({ gravite: "urgent", joursRestants: -1, kind: "soin_retard" })).toBe("critique")
    expect(etatEcheance({ gravite: "attention", joursRestants: -1, kind: "tarissement" })).toBe("attention")
    expect(etatEcheance({ gravite: "urgent", joursRestants: 6, kind: "attente_lait" })).toBe("info")
    expect(etatEcheance({ gravite: "urgent", joursRestants: 2, kind: "mise_bas" })).toBe("attention")
    expect(etatEcheance({ gravite: "info", joursRestants: 0, kind: "soin_planifie" })).toBe("info")
  })

  it("mène à l'écran de l'échéance, le lien porté par l'échéance d'abord", () => {
    expect(hrefEcheance({ kind: "soin_retard" })).toBe("/elevage?tab=alimentation&sub=soins")
    expect(hrefEcheance({ kind: "medicament_peremption", action: { href: "/x" } })).toBe("/x")
    expect(hrefEcheance({ kind: "administratif" })).toBe("/elevage?tab=calendrier")
  })
})
