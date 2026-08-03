import { describe, expect, it } from "vitest"
import { normaliserLibelle } from "./libelle-libre"

describe("normaliserLibelle", () => {
  it("supprime les espaces de bordure qui fabriquaient une espèce en double", () => {
    // Le cas de production : « Cerisier » avec une espace finale apparaissait
    // comme une seconde espèce dans le diagramme d'entretien.
    expect(normaliserLibelle("Cerisier ")).toBe("Cerisier")
    expect(normaliserLibelle("  Poirier")).toBe("Poirier")
  })

  it("réduit les espaces internes répétées", () => {
    expect(normaliserLibelle("Reinette   grise du Canada")).toBe("Reinette grise du Canada")
    expect(normaliserLibelle("Pommier\tGolden")).toBe("Pommier Golden")
  })

  it("préserve casse et accents : c'est un libellé, pas une clé", () => {
    expect(normaliserLibelle("Pêcher Roussane de Monein")).toBe("Pêcher Roussane de Monein")
  })

  it("distingue « champ absent » de « champ vidé »", () => {
    // Confondre les deux effacerait l'espèce à la première mise à jour partielle.
    expect(normaliserLibelle(undefined)).toBeUndefined()
    expect(normaliserLibelle(null)).toBeNull()
    expect(normaliserLibelle("")).toBeNull()
    expect(normaliserLibelle("   ")).toBeNull()
  })
})
