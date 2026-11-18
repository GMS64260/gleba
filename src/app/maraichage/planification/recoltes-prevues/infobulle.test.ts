import { describe, expect, it } from "vitest"

import { libelleUniteQuantite } from "@/lib/recolte/projection"
import { formatQuantite } from "@/lib/recolte/quantites"

import { quantiteInfobulle } from "./infobulle"

describe("infobulle du graphique des récoltes prévues", () => {
  it("lit l’unité sur la clé de la série : 360 tiges, pas 360 kg", () => {
    expect(quantiteInfobulle(360, "tige")).toBe("360 tiges")
    expect(quantiteInfobulle(12.5, "kg")).toBe(formatQuantite(12.5, "kg"))
    expect(quantiteInfobulle(40, "botte")).toBe("40 bottes")
  })

  it("le nom de légende d’une série n’est pas une unité (ancien appel)", () => {
    // Ce que le graphique passait : le libellé, replié en silence sur les kilos.
    const legende = libelleUniteQuantite("tige")
    expect(legende).toBe("tiges")
    expect(formatQuantite(360, legende as never)).toBe("360 kg")
  })
})
