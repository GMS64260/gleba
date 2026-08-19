import { describe, expect, it } from "vitest"

import {
  correspondEspece,
  distanceEdition,
  normaliserRecherche,
  scoreEspece,
  toleranceFrappe,
} from "@/lib/especes/recherche"

describe("normaliserRecherche", () => {
  it("retire accents, casse et espaces superflus", () => {
    expect(normaliserRecherche("  Céleri   Branche ")).toBe("celeri branche")
    expect(normaliserRecherche("Épinard")).toBe("epinard")
  })
})

describe("distanceEdition", () => {
  it("compte les opérations élémentaires", () => {
    expect(distanceEdition("chou", "chou", 2)).toBe(0)
    expect(distanceEdition("choux", "chou", 2)).toBe(1)
    expect(distanceEdition("rubarbe", "rhubarbe", 2)).toBe(1)
    expect(distanceEdition("amaranthe", "amarante", 2)).toBe(1)
    expect(distanceEdition("groseillers", "groseillier", 2)).toBe(2)
  })

  it("abandonne au-delà de la borne", () => {
    expect(distanceEdition("tomate", "courgette", 2)).toBe(3)
  })
})

describe("toleranceFrappe", () => {
  it("n'accorde aucune tolérance aux saisies très courtes", () => {
    expect(toleranceFrappe("ail")).toBe(0)
    expect(toleranceFrappe("chou")).toBe(1)
    expect(toleranceFrappe("groseillers")).toBe(2)
  })
})

describe("scoreEspece — cas réels de la friction du 2026-07-30", () => {
  // Saisies effectivement observées, et l'entrée du référentiel qui aurait dû
  // remonter mais que l'ancien `includes()` manquait.
  const cas: [string, string][] = [
    ["Choux", "Chou"],
    ["Amaranthe", "Amarante"],
    ["Rubarbe", "Rhubarbe"],
    ["Groseillers", "Groseillier"],
    ["Fraise", "Fraisier"],
    ["Coco", "Cocotier"],
  ]

  it.each(cas)("« %s » retrouve « %s »", (saisie, attendu) => {
    expect(correspondEspece(attendu, saisie)).toBe(true)
  })

  it("propose le générique sur une saisie composée", () => {
    expect(correspondEspece("Menthe", "Menthe poivree et marocaine")).toBe(true)
    expect(correspondEspece("Fenouil", "Fenouil, salade, carottes, celeri")).toBe(true)
  })

  it("ne remonte rien sur une espèce sans parenté dans le référentiel", () => {
    // Fenugrec et Consoude manquent réellement au référentiel : rien ne doit
    // les faire passer pour autre chose.
    expect(correspondEspece("Moutarde", "Fenugrec")).toBe(false)
    expect(correspondEspece("Courgette", "Consoude")).toBe(false)
    expect(correspondEspece("Haricot", "Pois chiche")).toBe(false)
  })

  it("ne suggère le générique d'une saisie composée qu'au score le plus faible", () => {
    // « Pois chiche » (Cicer arietinum) n'est pas « Pois » (Pisum sativum) :
    // la proposition est utile mais ne doit jamais primer sur une vraie
    // correspondance, et la création reste offerte en permanence côté UI.
    const suggestion = scoreEspece("Pois", "Pois chiche")
    expect(suggestion).toBe(0.4)
    expect(suggestion).toBeLessThan(scoreEspece("Chou", "Choux"))
  })
})

describe("scoreEspece — classement", () => {
  it("place l'exact devant le préfixe, puis la faute de frappe", () => {
    const exact = scoreEspece("Chou", "Chou")
    const prefixe = scoreEspece("Chou-fleur", "Chou")
    const faute = scoreEspece("Chou", "Choux")
    expect(exact).toBeGreaterThan(prefixe)
    expect(prefixe).toBeGreaterThan(faute)
  })

  it("accepte tout sur une requête vide", () => {
    expect(scoreEspece("Tomate", "")).toBe(1)
    expect(scoreEspece("Tomate", "   ")).toBe(1)
  })

  it("ignore les accents dans les deux sens", () => {
    expect(correspondEspece("Céleri", "celeri")).toBe(true)
    expect(correspondEspece("Celeri", "Céleri")).toBe(true)
    expect(correspondEspece("Épinard", "epinard")).toBe(true)
  })

  it("ne confond pas deux espèces courtes et distinctes", () => {
    expect(correspondEspece("Maïs", "Ail")).toBe(false)
    expect(correspondEspece("Ail", "Mais")).toBe(false)
  })

  it("ne renvoie jamais de score sur un nom vide", () => {
    expect(scoreEspece("", "chou")).toBe(0)
  })
})
