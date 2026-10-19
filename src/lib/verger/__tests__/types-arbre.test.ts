/**
 * QA 2026-10-19 — Verger > Arbres > Ajouter : le kiwi, « Liane fruitière » au
 * référentiel, n'avait ni type d'arbre ni onglet, et n'était proposé sous
 * aucun type dans le champ Espèce de la création.
 */
import { describe, expect, it } from "vitest"

import { ESPECE_TYPES_VERGER } from "@/lib/validations/espece"
import {
  TYPES_ARBRE,
  TYPES_ARBRE_FRUITIERS,
  categoriesEspecePourTypeArbre,
  couleurTypeArbre,
  estTypeArbre,
  estTypeArbreFruitier,
  libelleTypeArbre,
  messageTypeArbreInvalide,
  typeArbrePourCategorieEspece,
} from "../types-arbre"

describe("types d'arbre", () => {
  it("propose la liane fruitière à côté des types historiques", () => {
    expect(TYPES_ARBRE.map((t) => t.value)).toEqual(["fruitier", "petit_fruit", "liane", "forestier", "ornement", "haie"])
    expect(libelleTypeArbre("liane")).toBe("Liane fruitière")
    expect(TYPES_ARBRE.find((t) => t.value === "liane")?.labelPluriel).toBe("Lianes")
  })

  it("le champ Espèce d'une liane propose les espèces « liane » du référentiel (kiwi)", () => {
    expect(categoriesEspecePourTypeArbre("liane")).toEqual(["liane"])
  })

  it("fruitier et petit fruit proposent toujours les lianes, comme la fiche arbre depuis le 2026-10-08", () => {
    expect(categoriesEspecePourTypeArbre("fruitier")).toContain("liane")
    expect(categoriesEspecePourTypeArbre("petit_fruit")).toContain("liane")
  })

  it("forestier, ornemental, haie et types inconnus proposent toutes les espèces du verger", () => {
    expect(categoriesEspecePourTypeArbre("forestier")).toBeNull()
    expect(categoriesEspecePourTypeArbre("inconnu")).toBeNull()
  })

  it("chaque catégorie d'espèce du verger a son type d'arbre naturel", () => {
    for (const categorie of ESPECE_TYPES_VERGER) {
      const type = typeArbrePourCategorieEspece(categorie)
      expect(type).not.toBeNull()
      expect(categoriesEspecePourTypeArbre(type)).toContain(categorie)
    }
    expect(typeArbrePourCategorieEspece("legume")).toBeNull()
  })

  it("une liane produit des fruits : pollinisation, récoltes, étiquettes", () => {
    expect(TYPES_ARBRE_FRUITIERS).toContain("liane")
    expect(estTypeArbreFruitier("liane")).toBe(true)
    expect(estTypeArbreFruitier("haie")).toBe(false)
  })

  it("valide les types et nomme le champ dans le refus", () => {
    expect(estTypeArbre("liane")).toBe(true)
    expect(estTypeArbre("vivace")).toBe(false)
    expect(estTypeArbre(undefined)).toBe(false)
    const message = messageTypeArbreInvalide("vivace")
    expect(message).toContain("Type d'arbre inconnu")
    expect(message).toContain("Liane fruitière")
  })

  it("un type hérité hors liste reste lisible et coloré", () => {
    expect(libelleTypeArbre("vivace")).toBe("vivace")
    expect(couleurTypeArbre("vivace")).toBe(couleurTypeArbre("fruitier"))
    expect(couleurTypeArbre("liane")).not.toBe(couleurTypeArbre("fruitier"))
  })
})
