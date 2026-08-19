import { describe, expect, it } from "vitest"

import { nomDeBase, nomsCopiesEnLot, prochainNomCopie } from "@/lib/jardin/noms-copie"

describe("nomDeBase", () => {
  it("laisse un nom simple intact", () => {
    expect(nomDeBase("4")).toBe("4")
    expect(nomDeBase("Planche A")).toBe("Planche A")
  })

  it("retire la numérotation de copie", () => {
    expect(nomDeBase("4 (2)")).toBe("4")
    expect(nomDeBase("Planche A (12)")).toBe("Planche A")
  })

  it("retire les suffixes -copie hérités, même empilés", () => {
    expect(nomDeBase("4-copie")).toBe("4")
    expect(nomDeBase("4-copie-copie-copie-copie-copie-copie-copie")).toBe("4")
    expect(nomDeBase("4-copie-copie-copie-copie-copie2-copie")).toBe("4")
  })

  it("retire le suffixe « (copie) » des objets du plan", () => {
    expect(nomDeBase("Fleurs (copie)")).toBe("Fleurs")
    expect(nomDeBase("Fleurs (copie) (copie)")).toBe("Fleurs")
  })

  it("ne vide jamais un nom entièrement composé d'un suffixe", () => {
    expect(nomDeBase("-copie")).toBe("-copie")
    expect(nomDeBase("(2)")).toBe("(2)")
  })
})

describe("prochainNomCopie", () => {
  it("numérote à partir de 2", () => {
    expect(prochainNomCopie("4", ["4"])).toBe("4 (2)")
  })

  it("saute les numéros déjà pris", () => {
    expect(prochainNomCopie("4", ["4", "4 (2)", "4 (3)"])).toBe("4 (4)")
  })

  it("repart du nom de base quand on duplique une copie", () => {
    expect(prochainNomCopie("4 (3)", ["4", "4 (2)", "4 (3)"])).toBe("4 (4)")
  })

  it("normalise les anciens noms -copie au lieu de les empiler", () => {
    const existants = ["4", "4-copie", "4-copie-copie"]
    expect(prochainNomCopie("4-copie-copie", existants)).toBe("4 (2)")
  })

  it("reproduit le scénario réel des dix duplications successives", () => {
    // L'utilisateur duplique la planche « 4 » dix fois de suite ; chaque copie
    // devient la sélection courante, donc la source du tour suivant.
    const noms = ["1", "4", "20", "Planche A", "Planche B"]
    let source = "4"
    for (let i = 0; i < 10; i++) {
      source = prochainNomCopie(source, noms)
      noms.push(source)
    }
    expect(noms.slice(5)).toEqual([
      "4 (2)", "4 (3)", "4 (4)", "4 (5)", "4 (6)",
      "4 (7)", "4 (8)", "4 (9)", "4 (10)", "4 (11)",
    ])
  })
})

describe("nomsCopiesEnLot", () => {
  it("produit des noms distincts sans aller-retour serveur", () => {
    expect(nomsCopiesEnLot("4", ["4"], 3)).toEqual(["4 (2)", "4 (3)", "4 (4)"])
  })

  it("tient compte des noms déjà pris", () => {
    expect(nomsCopiesEnLot("4", ["4", "4 (2)"], 2)).toEqual(["4 (3)", "4 (4)"])
  })

  it("renvoie une liste vide pour zéro copie", () => {
    expect(nomsCopiesEnLot("4", ["4"], 0)).toEqual([])
  })
})
