import { describe, it, expect } from "vitest"
import { especeBaseId, especeBaseLabel, listEspecesBasePresentes } from "../espece-base"

describe("especeBaseId", () => {
  it("extrait l'espèce avant '_'", () => {
    expect(especeBaseId("poule_marans")).toBe("poule")
    expect(especeBaseId("brebis_lacaune")).toBe("brebis")
    expect(especeBaseId("vache_charolaise")).toBe("vache")
    expect(especeBaseId("cochon_culnoir_limousin")).toBe("cochon")
  })

  it("retombe sur l'id si pas de séparateur", () => {
    expect(especeBaseId("abeille")).toBe("abeille")
  })
})

describe("especeBaseLabel", () => {
  it("retourne le libellé FR", () => {
    expect(especeBaseLabel("poule_sussex")).toBe("Poule")
    expect(especeBaseLabel("chevre_alpine")).toBe("Chèvre")
    expect(especeBaseLabel("vache_normande")).toBe("Vache")
  })

  it("fallback sur la base brute si inconnu", () => {
    expect(especeBaseLabel("yak_himalaya")).toBe("yak")
  })
})

describe("listEspecesBasePresentes", () => {
  it("Bug #9 : ne renvoie pas les races (Lacaune, Sussex…), seulement les espèces de base", () => {
    const animaux = [
      { especeAnimaleId: "poule_marans" },
      { especeAnimaleId: "poule_sussex" },
      { especeAnimaleId: "brebis_lacaune" },
      { especeAnimaleId: "brebis_solognote" },
      { especeAnimaleId: "vache_charolaise" },
      { especeAnimaleId: "cochon_gascon" },
    ]
    const result = listEspecesBasePresentes(animaux)
    expect(result.map((r) => r.id)).toEqual(["brebis", "cochon", "poule", "vache"])
    expect(result.map((r) => r.label)).toEqual(["Brebis", "Cochon", "Poule", "Vache"])
  })

  it("liste vide si aucun animal", () => {
    expect(listEspecesBasePresentes([])).toEqual([])
  })

  it("dédoublonne", () => {
    const result = listEspecesBasePresentes([
      { especeAnimaleId: "poule_marans" },
      { especeAnimaleId: "poule_marans" },
      { especeAnimaleId: "poule_sussex" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe("Poule")
  })

  it("trié par libellé FR (Brebis < Chèvre < Poule)", () => {
    const result = listEspecesBasePresentes([
      { especeAnimaleId: "poule_marans" },
      { especeAnimaleId: "chevre_alpine" },
      { especeAnimaleId: "brebis_solognote" },
    ])
    expect(result.map((r) => r.label)).toEqual(["Brebis", "Chèvre", "Poule"])
  })
})
